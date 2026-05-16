# 11 · Migration guides

[← back to manual index](README.md)

Practical guides for leaving popular loggers **without rewriting your application**. In every case, the strategy is the same: build a thin compatibility layer that maps the old API → OIL.

## From Pino (Node)

### The API you had

```js
const pino = require('pino');
const logger = pino({
  base: { service: 'checkout', env: 'production' },
  redact: ['password', 'req.headers.authorization'],
});

logger.info({ order_id: 'o_4419' }, 'order placed');
logger.error({ err }, 'something broke');
```

### The equivalent in OIL

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  defaultMetadata: { service: 'checkout', env: 'production' },
  redactKeys: ['password', 'authorization'],  // OIL redacts by key name, not by path
  formatter: 'default',  // or 'datadog' / 'elastic' per your backend
});

// Note: arg order is (message, level, metadata) — Pino is (metadata, message)
log('order placed', 'info', { order_id: 'o_4419' });
log('something broke', 'error', { err: { message: err.message, stack: err.stack } });
```

### Drop-in compatibility shim

```js
// pino-shim.js — replace `require('pino')` with `require('./pino-shim')`
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

function makeLogger(opts = {}) {
  if (opts.base) configure({ defaultMetadata: opts.base });
  if (opts.redact) {
    const keys = (Array.isArray(opts.redact) ? opts.redact : opts.redact.paths || [])
      .map(p => p.split('.').pop()); // OIL works by key, not by path
    configure({ redactKeys: keys });
  }
  return {
    debug: (meta, msg) => log(msg ?? meta, 'debug', typeof meta === 'object' ? meta : {}),
    info:  (meta, msg) => log(msg ?? meta, 'info',  typeof meta === 'object' ? meta : {}),
    warn:  (meta, msg) => log(msg ?? meta, 'warn',  typeof meta === 'object' ? meta : {}),
    error: (meta, msg) => log(msg ?? meta, 'error', typeof meta === 'object' ? meta : {}),
    fatal: (meta, msg) => log(msg ?? meta, 'error', typeof meta === 'object' ? meta : {}),
    child: (binding) => {
      configure({ defaultMetadata: { ...binding } });
      return makeLogger(opts);
    },
  };
}

module.exports = makeLogger;
```

### Differences worth knowing

| Behavior | Pino | OIL |
|---|---|---|
| Redaction | by **path** (e.g. `req.headers.authorization`) | by **key name** (case-insensitive) |
| Output | NDJSON | NDJSON (one line per entry; remote transport sends an array body) |
| Baseline throughput | ~150k events/s/proc | ~10k events/s/proc |
| `.child()` bindings | supported | partial — `configure({ defaultMetadata })` is global, not nested |
| Custom levels | supported | not supported (only debug/info/warn/error) |

## From Winston (Node)

### The API you had

```js
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'checkout' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});

logger.info('order placed', { order_id: 'o_4419' });
```

### In OIL

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  transports: ['console', 'file'],
  filePath: 'app.log',
  defaultMetadata: { service: 'checkout' },
});

log('order placed', 'info', { order_id: 'o_4419' });
```

### Differences

| | Winston | OIL |
|---|---|---|
| Pluggable transports | ✓ (HTTP, Mongo, etc.) | ✗ (only native console/file/remote) |
| Format DSL | ✓ (`combine`, `printf`, `colorize`) | ✗ (plain JSON) |
| Custom levels | ✓ | ✗ |
| Pretty print | via format | use `jq -C` or `pino-pretty` at consumption time |

If you use custom Winston transports (Mongo, etc.), consider whether they still make sense — usually it's better to write JSON and have a shipper (Vector / fluent-bit) handle routing.

## From structlog (Python)

### The API you had

```python
import structlog

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

log = structlog.get_logger()
log.info("order.placed", order_id="o_4419", user_id="u_8821")
```

### In OIL

```python
from openinfra_logger import log, configure

configure(default_metadata={"service": "checkout"})

log("order.placed", "info", {"order_id": "o_4419", "user_id": "u_8821"})
```

### Drop-in shim

```python
# structlog_shim.py
from openinfra_logger import log as oil_log, configure

class StructlogShim:
    def __init__(self, **bindings):
        self._bindings = bindings

    def bind(self, **more):
        return StructlogShim(**{**self._bindings, **more})

    def _emit(self, level, event, **kw):
        oil_log(event, level, {**self._bindings, **kw})

    def debug(self, event, **kw): self._emit("debug", event, **kw)
    def info(self, event, **kw):  self._emit("info", event, **kw)
    def warning(self, event, **kw): self._emit("warn", event, **kw)
    def error(self, event, **kw): self._emit("error", event, **kw)

def get_logger(**bindings):
    return StructlogShim(**bindings)
```

```python
# Replace `import structlog` with `import structlog_shim as structlog`
log = structlog.get_logger(service="checkout")
log.info("order.placed", order_id="o_4419")
```

### Differences

| | structlog | OIL |
|---|---|---|
| Configurable processor chain | ✓ | ✗ (3 fixed formatters) |
| Context vars / thread-local | ✓ | ✗ (`defaultMetadata` is global) |
| Custom renderers | ✓ | ✗ |
| OTel integration | manual | automatic |

## From zap (Go)

### The API you had

```go
import "go.uber.org/zap"

logger, _ := zap.NewProduction()
defer logger.Sync()

logger.Info("order placed",
    zap.String("order_id", "o_4419"),
    zap.Int("amount", 1999),
)
```

### In OIL

```go
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"

openinfralogger.Configure(openinfralogger.Config{
    Transports:    []string{"console"},
    Formatter:     "default",
    RemoteHeaders: map[string]string{},
    DefaultMetadata: map[string]interface{}{"service": "checkout"},
})

openinfralogger.Log("order placed", "info", map[string]interface{}{
    "order_id": "o_4419",
    "amount":   1999,
})
```

### Shim

```go
// zap_shim.go
package zapshim

import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"

type Logger struct{ defaults map[string]interface{} }

func New() *Logger { return &Logger{defaults: map[string]interface{}{}} }

func (l *Logger) Info(msg string, fields ...Field) {
    md := make(map[string]interface{}, len(fields)+len(l.defaults))
    for k, v := range l.defaults { md[k] = v }
    for _, f := range fields { md[f.Key] = f.Val }
    openinfralogger.Log(msg, "info", md)
}
// (same for Debug/Warn/Error)

func (l *Logger) Sync() error { return nil }

type Field struct{ Key string; Val interface{} }
func String(k, v string) Field  { return Field{k, v} }
func Int(k string, v int) Field { return Field{k, v} }
// ... and the other zap.X helpers
```

### Differences

| | zap | OIL (Go) |
|---|---|---|
| Sugared logger | ✓ | ✗ (one API) |
| Field allocator pool | ✓ | ✗ (allocation per call) |
| Custom encoders | ✓ | ✗ |
| Custom levels | ✓ | ✗ |
| Sampling | ✓ | ✗ |
| Baseline throughput | ~1.5M events/s | ~50k events/s |

zap is dramatically faster in Go. OIL is worth it when you want **parity with Node/Python/Rust**, not maximum throughput.

## From tracing (Rust)

OIL's Rust v0.1 is too primitive to properly replace `tracing`. **Recommendation: keep tracing on Rust** and use OIL only if you need the exact JSON shape of the other runtimes (rare in a pure-Rust service). For v0.2, we plan a `tracing-subscriber` layer that delegates to OIL — so you keep the ergonomics of `tracing!(info, "msg", k = v)` and the canonical output.

## General migration plan (any logger)

1. **Add OIL alongside** the old logger. Configure both in a central `logging.js`.
2. **In two critical lines** (the hottest route + the error handler), emit through both loggers.
3. **Compare the JSONs** in a test pipe. Approve the canonical shape in your shipper/backend.
4. **Replace progressively** — one module per day. Don't force a big-bang.
5. **Remove the old logger** only after all production tests have passed for a week.

## Next

→ [12 · Troubleshooting](12-troubleshooting.md) — common symptoms and fixes.
