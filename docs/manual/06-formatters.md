# 06 · Formatters

[← back to manual index](README.md)

A **formatter** is a transformation applied to the entry JSON **after** metadata merge and **before** redaction. There are 3 in v0.1: `default`, `datadog`, `elastic`.

## When to use which

| You're using… | Use formatter… |
|---|---|
| stdout that some agent (Datadog Agent, fluent-bit, Vector) already normalizes | `default` |
| Datadog HTTP intake directly, no agent | `datadog` |
| Elastic / OpenSearch / Logstash ingesting ECS | `elastic` |
| Loki, Splunk, CloudWatch | `default` (LogQL and Splunk Search accept the canonical shape) |
| Custom in-house backend | `default` |

## Field-by-field comparison

Input (before the formatter):

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

### `formatter: 'default'`

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

(identical — no transformation)

### `formatter: 'datadog'`

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "status": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "dd.trace_id": "a4f1c9d3",
  "dd.span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

Mappings:

| Original | Becomes |
|---|---|
| `level` | `status` |
| `trace_id` | `dd.trace_id` |
| `span_id` | `dd.span_id` |

Other fields are preserved.

### `formatter: 'elastic'`

```json
{
  "@timestamp": "2026-05-16T03:42:01.041Z",
  "log.level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

Mappings:

| Original | Becomes |
|---|---|
| `timestamp` | `@timestamp` |
| `level` | `log.level` |
| `trace_id` | (kept — ECS accepts as-is) |
| `span_id` | (kept) |

## Edge cases

### `service` under ECS

ECS prefers `service.name` over a top-level `service`. OIL doesn't make this rename automatically in v0.1 — if you need strict ECS, pass `service.name` in `defaultMetadata`:

```js
configure({
  formatter: 'elastic',
  defaultMetadata: {
    'service.name': 'checkout-api',
    'service.environment': 'production',
  },
});
```

### `trace_id` with no span

If no OTel span is active, OIL **does not emit** `trace_id` (and therefore also does not emit `dd.trace_id`). Nothing shows up with `null` or `""`. Datadog/Elastic never receive an empty key.

### Caller wins, always

If you pass `trace_id` explicitly in metadata, OIL honors it:

```js
log('msg', 'info', { trace_id: 'manual-trace-123' });
```

Outputs as `trace_id: "manual-trace-123"` (or `dd.trace_id: "manual-trace-123"` under the datadog formatter). Useful for simulating a test span or backfilling.

### Mixing formatter with defaultMetadata

```js
configure({
  formatter: 'datadog',
  defaultMetadata: { service: 'api', status: 'override' }, // ← careful
});

log('test', 'info');
// → { "timestamp": "...", "message": "test", "status": "override", ... }
```

The `defaultMetadata.status` **overrides** what the datadog formatter just injected (because the formatter runs before the final merge). In general, **do not** use keys that collide with the formatter's mappings. Use neutral names (`level`, `trace_id`) and let the formatter do the work.

## How to add a custom formatter

In v0.1.0 the formatter list is fixed in code. For a custom formatter (e.g. Splunk with `splunk.` prefix), you have two options:

1. **Pre-position in defaultMetadata.** Works for 80% of cases.
2. **Shipper pipeline.** Configure OIL with `default` and convert in fluent-bit/Vector — that's where custom mappings really belong.

v0.2 will accept a `formatter: (entry) => entry` function. [Issue open on GitHub](https://github.com/jonathascordeiro20/openinfra-logger/issues) — PRs welcome.

## Compatibility with the pipeline

The formatter always runs **before** redaction:

```
1. merge metadata
2. formatter           ← renames keys (level → status, etc)
3. redaction           ← now operates on the renamed names
4. JSON.stringify
```

Practical implication: if you have `redactKeys: ['status']` (unusual, but hypothetically), and you use the datadog formatter, **the datadog `status` becomes `[REDACTED]`**. That's why the default redact list only contains universally sensitive names.

## Next

→ [07 · Auto-redaction](07-redaction.md) — the recursive algorithm, edge cases, and when it **won't** save you.
