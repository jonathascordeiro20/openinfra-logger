# 08 · OpenTelemetry integration

[← back to manual index](README.md)

OIL detects an active OpenTelemetry span at call time and injects `trace_id` and `span_id` into the log entry. **Zero configuration.** You just need OTel already installed and active in the process.

## How it works

The extraction function is defensive — it works if OTel is installed, fails silently if not:

```js
// Node implementation (simplified)
function extractTraceContext() {
  try {
    const otel = require('@opentelemetry/api');
    const span = otel.trace.getActiveSpan();
    if (span) {
      const ctx = span.spanContext();
      if (otel.trace.isSpanContextValid(ctx)) {
        return { trace_id: ctx.traceId, span_id: ctx.spanId };
      }
    }
  } catch (e) { /* OTel not installed, ignore */ }
  return {};
}
```

The function runs on **every** `log()` (cost: ~3 µs/call with OTel installed, ~0.5 µs without).

## Per-runtime support

| Runtime | Support | Expected package |
|---|---|---|
| **Node** | ✓ auto | `@opentelemetry/api` |
| **Python** | ✓ auto | `opentelemetry-api` (already installed if you used the `[opentelemetry]` extra) |
| **Go** | — | (v0.2 roadmap) |
| **Rust** | — | (v0.2 roadmap) |

## End-to-end example — Node

```js
const { trace } = require('@opentelemetry/api');
const { log } = require('@jonathascordeiro20/openinfra-logger');

// You configured OTel elsewhere (provider, exporter, etc).
const tracer = trace.getTracer('demo');

tracer.startActiveSpan('process-order', (span) => {
  log('starting', 'info', { order_id: 'o_4419' });
  // → "trace_id":"a4f1c9…","span_id":"b3d8e2…","order_id":"o_4419"

  // some logic…

  log('completed', 'info', { order_id: 'o_4419', status: 'ok' });
  // → same trace_id, SAME span_id

  span.end();
});

// Outside the span:
log('idle', 'info');
// → no "trace_id" or "span_id" present
```

## End-to-end example — Python

```python
from opentelemetry import trace
from openinfra_logger import log

tracer = trace.get_tracer("demo")

with tracer.start_as_current_span("process-order"):
    log("starting", "info", {"order_id": "o_4419"})
    # → "trace_id":"a4f1c9…","span_id":"b3d8e2…"
```

## How it shows up in each formatter

With no formatter or `formatter: 'default'`:

```json
{ "trace_id": "a4f1c9d3…", "span_id": "b3d8e2f7…", ... }
```

With `formatter: 'datadog'`:

```json
{ "dd.trace_id": "a4f1c9d3…", "dd.span_id": "b3d8e2f7…", ... }
```

With `formatter: 'elastic'`:

```json
{ "trace_id": "a4f1c9d3…", "span_id": "b3d8e2f7…", ... }
```

(ECS accepts the original names; v0.2 will offer `trace.id`/`span.id` if you need strict ECS.)

## When trace context **does not** appear

1. **OTel is not installed** — without the package in `node_modules`/`site-packages`, the try/catch silences the ImportError. Zero cost, clean behavior.
2. **No active span in context** — `getActiveSpan()` returns undefined outside `startActiveSpan` / a context manager.
3. **Span is `NonRecordingSpan` or invalid** — `isSpanContextValid` returns false; OIL skips the injection.
4. **You're in an async callback that lost context** — `setTimeout`, `process.nextTick`, etc. need manual propagation via the OTel context API. OIL does not do this for you.

## Vendor lock-in?

No. The OTel API package is the open standard. If you use Honeycomb, Lightstep, Tempo, Jaeger, or the Datadog agent that speaks OTel — all expose trace context via `@opentelemetry/api`. OIL knows nothing about the backend.

## When you **don't** want injection

Rare use case: you want to log outside a span without OIL trying to extract context.

v0.1 **always** tries to extract (overhead is very low). If this turns out to be a measurable problem in real profiles, open an issue — a `disableOtelExtraction: true` flag is trivial to add for v0.2.

## Combining trace context with defaultMetadata

The merge order is:

```
1. timestamp/level/message
2. defaultMetadata
3. trace context        ← can override
4. metadata from the call ← final override
```

Implication: you can **force** a trace_id by passing it in the metadata:

```js
log('replay', 'info', { trace_id: 'manual-replay-123' });
// → "trace_id":"manual-replay-123" (even inside an active span!)
```

Useful for backfill, event replay, or correlation across systems that don't share OTel.

## Next

→ [09 · Log analyzer](09-analyzer.md) — local CLI + LLM opt-in (3 providers).
