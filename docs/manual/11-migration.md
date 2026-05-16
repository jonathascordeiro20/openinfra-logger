# 11 · Migration guides

[← back to manual index](README.md)

Guias práticos para sair de loggers populares **sem reescrever a aplicação**. Em todos os casos, a estratégia é a mesma: criar uma fina camada de compatibilidade que mapeia a API antiga → OIL.

## From Pino (Node)

### A API que você tinha

```js
const pino = require('pino');
const logger = pino({
  base: { service: 'checkout', env: 'production' },
  redact: ['password', 'req.headers.authorization'],
});

logger.info({ order_id: 'o_4419' }, 'order placed');
logger.error({ err }, 'something broke');
```

### A API equivalente em OIL

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  defaultMetadata: { service: 'checkout', env: 'production' },
  redactKeys: ['password', 'authorization'],  // OIL redacta por key name, não por path
  formatter: 'default',  // ou 'datadog' / 'elastic' conforme seu backend
});

// Note: ordem dos args é (message, level, metadata) — Pino é (metadata, message)
log('order placed', 'info', { order_id: 'o_4419' });
log('something broke', 'error', { err: { message: err.message, stack: err.stack } });
```

### Shim de compatibilidade (drop-in)

```js
// pino-shim.js — substitua `require('pino')` por `require('./pino-shim')`
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

function makeLogger(opts = {}) {
  if (opts.base) configure({ defaultMetadata: opts.base });
  if (opts.redact) {
    const keys = (Array.isArray(opts.redact) ? opts.redact : opts.redact.paths || [])
      .map(p => p.split('.').pop()); // OIL trabalha em key, não em path
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

### Diferenças que valem saber

| Comportamento | Pino | OIL |
|---|---|---|
| Redação | por **path** (e.g. `req.headers.authorization`) | por **key name** (case-insensitive) |
| Output | NDJSON | NDJSON (uma linha por entry, JSON em transport remote vira array) |
| Throughput baseline | ~150k events/s/proc | ~10k events/s/proc |
| Filhos via `.child()` | suportado | parcial — `configure({ defaultMetadata })` é global, não nested |
| Custom levels | suportado | não (apenas debug/info/warn/error) |

## From Winston (Node)

### A API que você tinha

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

### Em OIL

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({
  transports: ['console', 'file'],
  filePath: 'app.log',
  defaultMetadata: { service: 'checkout' },
});

log('order placed', 'info', { order_id: 'o_4419' });
```

### Diferenças

| | Winston | OIL |
|---|---|---|
| Pluggable transports | ✓ (HTTP, Mongo, etc) | ✗ (apenas console/file/remote nativo) |
| Format DSL | ✓ (`combine`, `printf`, `colorize`) | ✗ (JSON puro) |
| Levels customizados | ✓ | ✗ |
| Pretty print | via format | use `jq -C` ou `pino-pretty` no consumo |

Se você usa transports custom do Winston (Mongo, etc), considere se isso ainda faz sentido — geralmente é melhor escrever em JSON e ter um shipper (Vector / fluent-bit) tratar o roteamento.

## From structlog (Python)

### A API que você tinha

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

### Em OIL

```python
from openinfra_logger import log, configure

configure(default_metadata={"service": "checkout"})

log("order.placed", "info", {"order_id": "o_4419", "user_id": "u_8821"})
```

### Shim para drop-in

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
# Substitua `import structlog` por `import structlog_shim as structlog`
log = structlog.get_logger(service="checkout")
log.info("order.placed", order_id="o_4419")
```

### Diferenças

| | structlog | OIL |
|---|---|---|
| Processor chain configurável | ✓ | ✗ (3 formatters fixos) |
| Context vars / thread-local | ✓ | ✗ (`defaultMetadata` é global) |
| Custom renderers | ✓ | ✗ |
| OTel integration | manual | automática |

## From zap (Go)

### A API que você tinha

```go
import "go.uber.org/zap"

logger, _ := zap.NewProduction()
defer logger.Sync()

logger.Info("order placed",
    zap.String("order_id", "o_4419"),
    zap.Int("amount", 1999),
)
```

### Em OIL

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
// (idem para Debug/Warn/Error)

func (l *Logger) Sync() error { return nil }

type Field struct{ Key string; Val interface{} }
func String(k, v string) Field  { return Field{k, v} }
func Int(k string, v int) Field { return Field{k, v} }
// ... e os outros helpers de zap.X
```

### Diferenças

| | zap | OIL (Go) |
|---|---|---|
| Sugared logger | ✓ | ✗ (uma única API) |
| Field allocator pool | ✓ | ✗ (alocação por chamada) |
| Custom encoders | ✓ | ✗ |
| Levels customizados | ✓ | ✗ |
| Sampling | ✓ | ✗ |
| Throughput baseline | ~1.5M events/s | ~50k events/s |

zap é dramaticamente mais rápido em Go. OIL vale a pena quando você quer **paridade com Node/Python/Rust**, não throughput máximo.

## From tracing (Rust)

A v0.1 do OIL Rust é primitiva demais para substituir `tracing` adequadamente. **Recomendação: mantenha tracing no Rust** e use OIL apenas se você precisa do JSON shape exato dos outros runtimes (o que é raro num serviço puro Rust). Para a v0.2, planejamos uma camada `tracing-subscriber` que delega para OIL — então você fica com a ergonomia do `tracing!(info, "msg", k = v)` e o output canônico.

## Plano de migração geral (qualquer logger)

1. **Adicione OIL em paralelo** ao logger antigo. Configure os dois em um arquivo `logging.js` central.
2. **Em duas linhas críticas** (rota mais quente + handler de erro), emita pelos dois loggers.
3. **Compare os JSONs** numa pipe de teste. Aprove o shape canônico no seu shipper / backend.
4. **Substitua progressivamente** — um módulo por dia. Não force big-bang.
5. **Remova o logger antigo** apenas depois que todos os testes de produção passaram por uma semana.

## Próximo passo

→ [12 · Troubleshooting](12-troubleshooting.md) — sintomas comuns e correções.
