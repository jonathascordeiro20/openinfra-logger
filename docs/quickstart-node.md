# Quickstart — Node.js

A 5-minute introduction. By the end you'll have structured logs hitting stdout, a file, and a remote endpoint, with sensitive fields automatically redacted.

## Install

```bash
npm install @jonathascordeiro20/openinfra-logger
```

## 1. Your first log

```js
const { log } = require('@jonathascordeiro20/openinfra-logger');

log('Server started', 'info');
log('Failed to parse payload', 'error', { request_id: 'abc-123' });
```

Output:

```text
{"timestamp":"2026-05-15T13:42:01.041Z","level":"info","message":"Server started"}
{"timestamp":"2026-05-15T13:42:01.058Z","level":"error","message":"Failed to parse payload","request_id":"abc-123"}
```

## 2. Default metadata for every entry

You almost certainly want a `service` and `env` field on every log line. Set them once with `configure`:

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  defaultMetadata: { service: 'checkout-api', env: process.env.NODE_ENV ?? 'dev' }
});

log('Order created', 'info', { order_id: 'o_4419' });
// → "service":"checkout-api","env":"production","order_id":"o_4419"
```

## 3. Multiple transports

```js
configure({
  transports: ['console', 'file', 'remote'],
  filePath: './production.log',
  remoteUrl: 'https://logs.my-infrastructure.com/ingest',
  defaultMetadata: { service: 'checkout-api' }
});
```

- **console** — pretty for local dev and container logs
- **file** — appends one JSON line per entry, ordering preserved even under burst writes
- **remote** — buffered: up to 100 entries or 2 s flush, whichever comes first

## 4. Auto-redaction (LGPD / GDPR)

Sensitive keys are intercepted **before** any transport sees them:

```js
log('login attempt', 'info', {
  user: 'alice',
  password: 'p@ss',
  card: { number: '4111-1111-1111-1111' }
});
// → "user":"alice","password":"[REDACTED]","card":{"number":"4111-1111-1111-1111"}
```

Wait — the `card.number` wasn't redacted. By default OIL redacts these top-level key names (case-insensitive, recursive):

```
password · token · secret · api_key · credit_card
```

`card.number` doesn't match any of them. To redact `number` as well:

```js
configure({ redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card', 'number'] });
```

Or rename the field to one that matches the default list:

```js
log('login attempt', 'info', { user: 'alice', credit_card: '4111-1111-1111-1111' });
// → "user":"alice","credit_card":"[REDACTED]"
```

## 5. Datadog or Elastic

One config line switches the wire format. The library does **not** ship the Datadog agent — it formats the JSON exactly as Datadog and Elastic expect.

```js
configure({ formatter: 'datadog' });
// → "status":"info" (instead of "level"), "dd.trace_id":"…" (instead of "trace_id")

configure({ formatter: 'elastic' });
// → "@timestamp":"…", "log.level":"info"
```

## 6. OpenTelemetry — automatic

If an OTel span is active when you call `log()`, the `trace_id` and `span_id` are injected automatically. No extra import; no extra config.

```js
const { trace } = require('@opentelemetry/api');
const { log } = require('@jonathascordeiro20/openinfra-logger');

const tracer = trace.getTracer('demo');

tracer.startActiveSpan('process-order', (span) => {
  log('processing', 'info', { order_id: 'o_4419' });
  // → "trace_id":"a4f1c9…", "span_id":"b3d8e2…", "order_id":"o_4419"
  span.end();
});
```

## 7. Express middleware (10 lines)

```js
const express = require('express');
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({ defaultMetadata: { service: 'api' } });

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('request', 'info', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start
    });
  });
  next();
});

app.get('/', (_req, res) => res.json({ ok: true }));
app.listen(3000);
```

## Where to go next

- [docs/advanced-configuration.md](advanced-configuration.md) — every `configure()` option
- [docs/integration.md](integration.md) — Datadog, Elastic, Loki, Splunk wiring
- [docs/architecture.md](architecture.md) — why we built it from stdlib only
- [examples/](../examples/) — end-to-end runnable samples
