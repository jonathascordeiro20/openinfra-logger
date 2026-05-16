# 02 · Concepts

[← back to manual index](README.md)

## The JSON contract

Every call to `log(message, level, metadata)` produces a JSON line with at least these fields:

| Field | Type | Always present? | Notes |
|---|---|---|---|
| `timestamp` | ISO-8601 string with trailing `Z` | yes (formatter `default`) | renamed to `@timestamp` under formatter `elastic` |
| `level` | lowercase string | yes (formatter `default`) | renamed to `status` (datadog) or `log.level` (elastic) |
| `message` | string | yes | free-form |
| fields from `defaultMetadata` | any JSON-serializable | when configured | global merge |
| `trace_id` / `span_id` | hex string | when an OTel span is active | renamed to `dd.trace_id`/`dd.span_id` under datadog |
| fields from the call's `metadata` | any JSON-serializable | when passed | **overrides** earlier fields (caller wins) |

### Merge order

```
       ┌──────────────────┐
       │ 1. timestamp     │
       │ 2. level         │
       │ 3. message       │
       └──────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 4. defaultMetadata (from configure()) │
       └──────────────────────────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 5. trace context (extract_trace_context()) │
       └──────────────────────────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 6. metadata from the call (caller wins) │
       └──────────────────────────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 7. formatter (default/datadog/elastic) │
       └──────────────────────────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 8. redaction (recursive)             │
       └──────────────────────────────────────┘
              ↓
       ┌──────────────────────────────────────┐
       │ 9. JSON.stringify → transports       │
       └──────────────────────────────────────┘
```

This pipeline is deterministic and identical across all four implementations.

## The four levels

```
debug = 10     dev-only spam, deeply technical
info  = 20     normal flow, business events
warn  = 30     attention but no human action yet
error = 40     attention now, on-call relevant
```

Invalid levels silently fall back to `info` (with a structured warning on stderr explaining what happened — only once per unknown level per session).

## The three transports

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  console   │  │   file     │  │   remote   │
├────────────┤  ├────────────┤  ├────────────┤
│ stdout/    │  │ append-    │  │ POST batch │
│ stderr     │  │ only, .log │  │ to URL,    │
│ JSON line  │  │ JSON line  │  │ buffered   │
│ per call   │  │ per call,  │  │ N or T ms  │
│            │  │ ordered    │  │            │
└────────────┘  └────────────┘  └────────────┘
```

A `transports: ['console','file','remote']` list fires all three simultaneously. Each is independent — a failure in one doesn't break the others.

Operational detail in [05 · Transports](05-transports.md).

## The three formatters

| Formatter | `timestamp` | `level` | `trace_id` | `span_id` |
|---|---|---|---|---|
| `default` | `timestamp` | `level` | `trace_id` | `span_id` |
| `datadog` | `timestamp` | `status` | `dd.trace_id` | `dd.span_id` |
| `elastic` | `@timestamp` | `log.level` | `trace_id` | `span_id` |

Detail in [06 · Formatters](06-formatters.md).

## The auto-redaction rule

```
For every value V in the log entry:
  if V is a dict / object:
    for every key K, V[K]:
      if K.lower() in redactKeys:
        V[K] = "[REDACTED]"
      else:
        recurse into V[K]
  if V is a list / array:
    recurse into every element
  else:
    leave V as-is
```

Defaults: `password`, `token`, `secret`, `api_key`, `credit_card`. Edge cases in [07 · Auto-redaction](07-redaction.md).

## Per-runtime architecture

Each implementation has five pieces, written using only the standard library:

```
┌──────────────────────────────────────────────────────────────────┐
│                          public API                              │
│  log(message, level, metadata)   configure(...)                  │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              ↓               ↓                   ↓
   ┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐
   │ default metadata │ │ trace ctx    │ │ caller metadata │
   │ merge            │ │ extract      │ │ merge           │
   └──────────────────┘ └──────────────┘ └─────────────────┘
                              │
                              ↓
                ┌─────────────────────────┐
                │ formatter (datadog/...) │
                └─────────────────────────┘
                              │
                              ↓
                ┌─────────────────────────┐
                │ redactObject (recursive)│
                └─────────────────────────┘
                              │
                              ↓
   ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
   │  console     │ │  file        │ │  remote (batch)  │
   │  fmt.Println │ │  append+chain│ │  HTTP POST       │
   └──────────────┘ └──────────────┘ └──────────────────┘
```

What differs between runtimes is the implementation, not the pipeline:

- **Node:** a `Promise` chain serializes file appends, `setTimeout` schedules the remote flush.
- **Python:** `threading.Timer` schedules the remote flush, `urllib.request.urlopen` does the POST.
- **Go:** `fmt.Println` directly, `os.OpenFile`, a fire-and-forget goroutine for the remote.
- **Rust:** zero-dep JSON builder (`escape_json_string`, RFC 8259-compliant), `OpenOptions` for files.

## Zero-dependency claim

What the phrase means:

```
✓  npm install @jonathascordeiro20/openinfra-logger
   → 0 transitive packages installed

✓  pip install openinfra-logger
   → 0 transitive packages installed

✓  cargo add openinfra-logger
   → 0 transitive crates compiled

✓  go get github.com/jonathascordeiro20/openinfra-logger/go
   → 0 transitive modules added
```

What the phrase **does not** mean:

- It does **not** mean "zero network calls". The remote transport speaks HTTP. The log analyzer with `--llm=anthropic` calls an external API. The OpenTelemetry hook makes no call but requires that **you** have `@opentelemetry/api` or `opentelemetry-api` installed in your project if you want it to detect spans.
- It does **not** mean "`no_std`-compatible in Rust" — v0.1 uses `std::fs` for the file transport. A `no_std` variant is on the roadmap.
- It does **not** mean tests use no dependencies — they use each language's testing framework (`node:test`, `unittest`, `testing`, `cargo test`). This is zero-dep at **runtime**, not in development.

The correctly narrated interpretation: **"the package itself brings no other package into your dependency tree."**

## Next

→ [03 · Installation](03-installation.md) — minimum versions, exact command per runtime, and how to verify the install worked.
