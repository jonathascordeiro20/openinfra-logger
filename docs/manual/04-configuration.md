# 04 · Configuration

[← back to manual index](README.md)

Each runtime has a single configuration function/method. Semantics are the same: you pass an object/struct with the fields you want to change; omitted fields keep their defaults.

## Fields shared across all 4 runtimes

| Field | Type | Default | Purpose |
|---|---|---|---|
| `transports` | array of strings | `["console"]` | Which transports to enable (`console`, `file`, `remote`) |
| `filePath` / `file_path` / `FilePath` | string | `"./app.log"` | Absolute or relative path for the file transport |
| `remoteUrl` / `remote_url` / `RemoteURL` | string | `null` / `""` | POST endpoint for the remote transport |
| `remoteHeaders` / `remote_headers` / `RemoteHeaders` | object | `{"Content-Type":"application/json"}` | HTTP headers for the remote |
| `defaultMetadata` / `default_metadata` / `DefaultMetadata` | object | `{}` | Fields injected into **every** entry |
| `formatter` / `Formatter` | string | `"default"` | `default`, `datadog`, or `elastic` |
| `redactKeys` / `redact_keys` | array of strings | `["password","token","secret","api_key","credit_card"]` | Keys (case-insensitive) replaced with `[REDACTED]` |
| `batchSize` / `batch_size` | int | `100` | Batch size for the remote transport |
| `flushIntervalMs` / `flush_interval_ms` | int | `2000` | Maximum window (ms) before a forced batch flush |

## Per-runtime differences

### Node.js — `configure(options)`

```js
const { configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  transports: ['console', 'file', 'remote'],
  filePath: './app.log',
  remoteUrl: 'https://logs.example.com/ingest',
  remoteHeaders: { 'Content-Type': 'application/json', 'X-Api-Key': 'k_…' },
  defaultMetadata: { service: 'checkout', env: 'prod' },
  formatter: 'datadog',
  redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card', 'ssn'],
  batchSize: 100,
  flushIntervalMs: 2000,
});
```

**Semantics:** `configure()` **merges** with the previous state (`Object.assign`). You can call it multiple times; only the fields you pass change.

### Python — `configure(**kwargs)`

```python
from openinfra_logger import configure

configure(
    transports=['console', 'file', 'remote'],
    file_path='./app.log',
    remote_url='https://logs.example.com/ingest',
    remote_headers={'Content-Type': 'application/json', 'X-Api-Key': 'k_…'},
    default_metadata={'service': 'checkout', 'env': 'prod'},
    formatter='datadog',
    redact_keys=['password', 'token', 'secret', 'api_key', 'credit_card', 'ssn'],
    batch_size=100,
    flush_interval_ms=2000,
)
```

**Semantics:** arguments are keyword-only and **merge** via `dict.update`.

### Go — `Configure(cfg Config)`

```go
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"

openinfralogger.Configure(openinfralogger.Config{
    Transports:    []string{"console", "file", "remote"},
    FilePath:      "./app.log",
    RemoteURL:     "https://logs.example.com/ingest",
    RemoteHeaders: map[string]string{"Content-Type": "application/json"},
    DefaultMetadata: map[string]interface{}{
        "service": "checkout",
        "env":     "prod",
    },
    Formatter: "datadog",
})
```

**Semantics:** `Configure(cfg Config)` **replaces** the whole struct (no merge). Always pass every field you want to keep; zero-value fields (`""`, `nil`) overwrite the defaults.

**Known (v0.1.0):** `RedactKeys`, `BatchSize`, `FlushIntervalMs` don't exist yet. Native redaction and batching in Go are on the v0.2 roadmap.

### Rust — `Logger::new(Config)`

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

let mut defaults = HashMap::new();
defaults.insert("service".to_string(), "checkout".to_string());
defaults.insert("env".to_string(),     "prod".to_string());

let cfg = Config {
    transports: vec!["console".to_string(), "file".to_string()],
    file_path: "./app.log".to_string(),
    default_metadata: defaults,
};

let logger = Logger::new(cfg);
```

**Semantics:** no global mutable. Each `Logger` owns its `Config`. You can create multiple loggers with different configs (e.g. one for errors to file, another for info to stdout).

**Known (v0.1.0):** the Rust `Config` struct does not expose `formatter`, `redact_keys`, `remote_*` yet. All of that lands in v0.2.

## Log levels

The 4 valid levels are `debug`, `info`, `warn`, `error`. Input is case-insensitive:

```js
log('msg', 'ERROR');   // → "level":"error"
log('msg', 'Warn');    // → "level":"warn"
log('msg', 'verbose'); // emit warning, then "level":"info"
```

An invalid level **never crashes the process** — it becomes `info` with a structured warning on stderr (JSON, like a normal log). This is intentional: logs must never kill production.

### Numeric hierarchy

```
debug = 10
info  = 20
warn  = 30
error = 40
```

Useful if you want to filter by threshold at consumption time. In v0.1, **OIL does not filter** — every level is emitted. If you want "prod only ≥ info", filter in the shipper (Vector, fluent-bit) or in the Datadog/Elastic query.

## Consolidated defaults

```js
{
  transports: ['console'],
  filePath: './app.log',
  remoteUrl: null,
  remoteHeaders: { 'Content-Type': 'application/json' },
  defaultMetadata: {},
  formatter: 'default',
  redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card'],
  batchSize: 100,
  flushIntervalMs: 2000
}
```

These are the production values if you never call `configure()`.

## Configuration patterns

### "Local dev"

```js
configure({
  transports: ['console'],
  formatter: 'default',
  defaultMetadata: { env: 'dev' },
});
```

### "Production into Datadog"

```js
configure({
  transports: ['console'],  // Datadog Agent collects from stdout
  formatter: 'datadog',
  defaultMetadata: { service: 'checkout-api', env: 'production' },
});
```

### "Production into Elastic with on-disk retention"

```js
configure({
  transports: ['console', 'file'],
  filePath: '/var/log/app/app.jsonl',
  formatter: 'elastic',
  defaultMetadata: { service: 'checkout-api', env: 'production' },
});
```

### "Edge / serverless / no local disk"

```js
configure({
  transports: ['console', 'remote'],
  remoteUrl: 'https://logs.example.com/ingest',
  remoteHeaders: { 'Authorization': 'Bearer ' + process.env.LOG_TOKEN },
  batchSize: 25,         // smaller: invocations are short
  flushIntervalMs: 500,  // more aggressive: the Worker exits in 30s
});
```

### "LGPD aggressive"

```js
configure({
  redactKeys: [
    // defaults
    'password', 'token', 'secret', 'api_key', 'credit_card',
    // additional
    'cpf', 'rg', 'cnpj', 'phone', 'email', 'ssn', 'address',
    'birthdate', 'mother_name'
  ],
});
```

## Programmatic config vs environment

v0.1 **does not read environment variables automatically**. You decide:

```js
configure({
  remoteUrl: process.env.LOG_REMOTE_URL,
  defaultMetadata: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    env:     process.env.NODE_ENV ?? 'dev',
  },
});
```

This is intentional: v0.1 doesn't want to guess which env vars are yours, and wants configuration to stay explicit and auditable.

## Next

→ [05 · Transports](05-transports.md) — detailed behavior of `console`, `file`, `remote`.
