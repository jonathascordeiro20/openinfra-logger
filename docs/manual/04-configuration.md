# 04 · Configuração

[← back to manual index](README.md)

Cada runtime tem uma única função/método de configuração. A semântica é a mesma: você passa um objeto/struct com os campos que quer mudar; os omitidos mantêm o default.

## Campos comuns aos 4 runtimes

| Campo | Tipo | Default | O que faz |
|---|---|---|---|
| `transports` | array de strings | `["console"]` | Quais transports ativar (`console`, `file`, `remote`) |
| `filePath` / `file_path` / `FilePath` | string | `"./app.log"` | Path absoluto ou relativo para o file transport |
| `remoteUrl` / `remote_url` / `RemoteURL` | string | `null` / `""` | Endpoint POST para o remote transport |
| `remoteHeaders` / `remote_headers` / `RemoteHeaders` | object | `{"Content-Type":"application/json"}` | Headers HTTP do remote |
| `defaultMetadata` / `default_metadata` / `DefaultMetadata` | object | `{}` | Campos que entram em **toda** entrada |
| `formatter` / `Formatter` | string | `"default"` | `default`, `datadog` ou `elastic` |
| `redactKeys` / `redact_keys` | array de strings | `["password","token","secret","api_key","credit_card"]` | Lista de keys (case-insensitive) substituídas por `[REDACTED]` |
| `batchSize` / `batch_size` | int | `100` | Tamanho do batch do remote transport |
| `flushIntervalMs` / `flush_interval_ms` | int | `2000` | Janela máxima (ms) antes do flush forçado do batch |

## Diferenças entre runtimes

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

**Semântica:** `configure()` faz **merge** com o estado anterior (`Object.assign`). Você pode chamar várias vezes; apenas os campos que passar mudam.

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

**Semântica:** os argumentos são keyword-only e fazem **merge** com o config anterior via `dict.update`.

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

**Semântica:** `Configure(cfg Config)` **substitui** o struct inteiro (não há merge). Sempre passe todos os campos que você quer manter; campos zero-value (`""`, `nil`) substituem os defaults.

**Conhecida** (v0.1.0): não há `RedactKeys`, `BatchSize`, `FlushIntervalMs` ainda. Redaction e batching nativos são roadmap para v0.2 do Go.

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

**Semântica:** sem mutável global. Cada `Logger` tem o próprio `Config`. Você pode criar múltiplos loggers com configs distintos (e.g. um para errors em arquivo, outro para info em stdout).

**Conhecida** (v0.1.0): a struct `Config` em Rust ainda não expõe `formatter`, `redact_keys`, `remote_*`. Tudo isso chega na v0.2.

## Log levels

Os 4 níveis válidos são `debug`, `info`, `warn`, `error`. Tudo case-insensitive na entrada:

```js
log('msg', 'ERROR');   // → "level":"error"
log('msg', 'Warn');    // → "level":"warn"
log('msg', 'verbose'); // emit warning, then "level":"info"
```

Nível inválido **não derruba o processo** — vira `info` com um warning estruturado em stderr (formato JSON, igual ao log normal). Isso é proposital: logs nunca devem matar produção.

### Hierarquia numérica

```
debug = 10
info  = 20
warn  = 30
error = 40
```

Útil se você quer filtrar por threshold no consumo. Nas v0.1, **OIL não filtra** — todo nível é emitido. Se você quer "produção só ≥ info", filtre no shipper (Vector, fluent-bit) ou na query do Datadog.

## Defaults consolidados

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

Esses são os valores em produção se você nunca chamar `configure()`.

## Padrões de configuração

### "Dev local"

```js
configure({
  transports: ['console'],
  formatter: 'default',
  defaultMetadata: { env: 'dev' },
});
```

### "Produção em Datadog"

```js
configure({
  transports: ['console'],  // o Datadog Agent coleta de stdout
  formatter: 'datadog',
  defaultMetadata: { service: 'checkout-api', env: 'production' },
});
```

### "Produção em Elastic com retenção em arquivo"

```js
configure({
  transports: ['console', 'file'],
  filePath: '/var/log/app/app.jsonl',
  formatter: 'elastic',
  defaultMetadata: { service: 'checkout-api', env: 'production' },
});
```

### "Edge / serverless / sem disco"

```js
configure({
  transports: ['console', 'remote'],
  remoteUrl: 'https://logs.example.com/ingest',
  remoteHeaders: { 'Authorization': 'Bearer ' + process.env.LOG_TOKEN },
  batchSize: 25,         // menor: invocations são curtas
  flushIntervalMs: 500,  // mais agressivo: o Worker termina em 30 s
});
```

### "LGPD aggressive"

```js
configure({
  redactKeys: [
    // defaults
    'password', 'token', 'secret', 'api_key', 'credit_card',
    // adicionais
    'cpf', 'rg', 'cnpj', 'phone', 'email', 'ssn', 'address',
    'birthdate', 'mother_name'
  ],
});
```

## Configuração programática vs ambiente

A v0.1 **não lê variáveis de ambiente automaticamente**. Você decide:

```js
configure({
  remoteUrl: process.env.LOG_REMOTE_URL,
  defaultMetadata: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    env:     process.env.NODE_ENV ?? 'dev',
  },
});
```

É proposital: a v0.1 não quer adivinhar quais env vars são suas, e quer manter a configuração explícita e auditável.

## Próximo passo

→ [05 · Transports](05-transports.md) — comportamento detalhado de `console`, `file`, `remote`.
