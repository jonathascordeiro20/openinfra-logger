# 14 · API reference

[← back to manual index](README.md)

Assinaturas completas e exatas das APIs públicas, por runtime, em v0.1.0.

## Node.js

```js
const { log, configure, LEVELS } = require('@jonathascordeiro20/openinfra-logger');
```

### `log(message, level, metadata)`

```
log(message: string, level?: string, metadata?: object): void
```

| Parâmetro | Tipo | Default | Comportamento |
|---|---|---|---|
| `message` | `string` | — | Obrigatório. Texto livre, **não** é redatado |
| `level` | `string` | `'info'` | `debug`/`info`/`warn`/`error` (case-insensitive). Outros viram `info` |
| `metadata` | `object` | `{}` | Campos arbitrários JSON-serializable. Redaction aplicada recursivamente |

Não retorna. Não lança em fluxo normal — erros internos vão para `console.error` e o processo continua.

### `configure(options)`

```
configure(options: Partial<Options>): void
```

`Options`:

```ts
{
  transports: ('console' | 'file' | 'remote')[];   // default: ['console']
  filePath: string;                                 // default: './app.log'
  remoteUrl: string | null;                         // default: null
  remoteHeaders: Record<string, string>;            // default: { 'Content-Type': 'application/json' }
  defaultMetadata: Record<string, unknown>;         // default: {}
  formatter: 'default' | 'datadog' | 'elastic';     // default: 'default'
  redactKeys: string[];                             // default: ['password','token','secret','api_key','credit_card']
  batchSize: number;                                // default: 100
  flushIntervalMs: number;                          // default: 2000
}
```

Semântica: **merge** com config anterior. Você pode chamar várias vezes; apenas campos passados mudam.

### `LEVELS`

```js
const { LEVELS } = require('@jonathascordeiro20/openinfra-logger');
// LEVELS === { debug: 10, info: 20, warn: 30, error: 40 }
```

Útil para comparações numéricas se você quiser filtrar consumindo. OIL **não filtra** internamente.

## Python

```python
from openinfra_logger import log, configure, redact_object
```

### `log(message, level='info', metadata=None)`

```
log(message: str, level: str = 'info', metadata: dict | None = None) -> None
```

Idêntico ao Node em semântica. `metadata=None` é tratado como `{}` — você pode omitir.

### `configure(**kwargs)`

Argumentos keyword-only (snake_case):

```
configure(
    transports: list[str] = ...,
    file_path: str = ...,
    remote_url: str | None = ...,
    remote_headers: dict = ...,
    default_metadata: dict = ...,
    formatter: str = ...,
    redact_keys: list[str] = ...,
    batch_size: int = ...,
    flush_interval_ms: int = ...,
)
```

Defaults idênticos ao Node. Merge via `dict.update`.

### `redact_object(obj, keys_to_redact)`

```
redact_object(obj: Any, keys_to_redact: list[str]) -> Any
```

A função pura de redação, exposta para testes e uso direto. Não é chamada por você no fluxo normal.

## Go

```go
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"
```

### `func Log(message string, level string, metadata map[string]interface{})`

```
openinfralogger.Log(
    message string,
    level string,
    metadata map[string]interface{},  // pode ser nil
)
```

Sem retorno. Erros internos vão para `log.Printf` em stderr.

### `func Configure(cfg Config)`

```go
type Config struct {
    Transports      []string
    FilePath        string
    RemoteURL       string
    RemoteHeaders   map[string]string
    DefaultMetadata map[string]interface{}
    Formatter       string
}
```

**Atenção:** `Configure` substitui o struct inteiro. Sempre passe **todos** os campos que você quer manter. Campos zero-value (`""`, `nil`) sobrescrevem os defaults.

Não há `RedactKeys`, `BatchSize`, `FlushIntervalMs` ainda na implementação Go — chegam em v0.2.

## Rust

```rust
use openinfra_logger::{Logger, Config, escape_json_string, build_json_line};
use std::collections::HashMap;
```

### `Logger::new(config) -> Logger`

```rust
pub fn new(config: Config) -> Self
```

Cria uma instância de Logger. Múltiplos loggers podem coexistir com configs distintos (sem singleton global).

### `Logger::log(&self, message, level, metadata)`

```rust
pub fn log(&self, message: &str, level: &str, metadata: HashMap<String, String>)
```

Sem retorno. Falhas no I/O são silenciosas.

### `Config`

```rust
pub struct Config {
    pub transports: Vec<String>,
    pub file_path: String,
    pub default_metadata: HashMap<String, String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            transports: vec!["console".to_string()],
            file_path: "./app.log".to_string(),
            default_metadata: HashMap::new(),
        }
    }
}
```

Não há `formatter`, `redact_keys`, `remote_url` na v0.1 do Rust — chegam em v0.2.

### Funções públicas auxiliares (pure functions, testáveis)

```rust
pub fn escape_json_string(s: &str) -> String
```

Escapa uma string para inclusão segura como JSON string value (RFC 8259-compliant). Exposta para uso direto se você precisa construir JSON parcial fora do Logger.

```rust
pub fn build_json_line(
    message: &str,
    level: &str,
    timestamp_secs: u64,
    default_metadata: &HashMap<String, String>,
    metadata: &HashMap<String, String>,
) -> String
```

Constrói a linha JSON exatamente como o Logger emite. Útil para testes deterministicos com timestamp injetado.

## CLI — log analyzer

Não é uma API de biblioteca, é um script:

```bash
npm run analyze <log-file> [-- <flags>]
```

Flags:

| Flag | Comportamento |
|---|---|
| nenhuma | Análise local 7 camadas, zero rede |
| `--llm=anthropic` | Cloud Claude (precisa `ANTHROPIC_API_KEY`) |
| `--llm=ollama` | Local LLM via Ollama (`OLLAMA_HOST`, `OLLAMA_MODEL`) |
| `--llm=openai` | OpenAI-compatible (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`) |
| `--prompt-only` | Imprime prompt para colar em chat |
| `--help` ou `-h` | Mostra todos os flags e env vars |

Exit codes:

- `0` — sucesso, ou nenhum erro encontrado, ou prompt-only print
- `1` — file not found, network failure (em modo `--llm=*`), API error
- `2` — flag desconhecido

## Mudanças semver

Todas as APIs públicas listadas acima são **estáveis** dentro de uma versão major. Breaking changes em qualquer uma delas exigem bump major:

- Renomear `log` → `oilLog` seria 2.0
- Mudar `configure()` para retornar o config consolidado seria 2.0
- Adicionar campo opcional ao `Config` (Rust) é 0.2 (minor)
- Adicionar `flush()` exposto é 0.2 (minor)
- Fix de bug que muda comportamento observável documentado pode ser 0.1.1 (patch) ou 0.2 (minor) dependendo da severidade

Critério: o teste oficial e a documentação canônica em v0.1.0 são o "contrato". Mudanças que invalidam testes existentes são breaking.

## Onde está cada implementação

| Runtime | Arquivo principal | Linhas |
|---|---|---|
| Node | [`src/index.js`](../../src/index.js) | ~200 |
| Python | [`python/openinfra_logger/__init__.py`](../../python/openinfra_logger/__init__.py) | ~200 |
| Go | [`go/logger.go`](../../go/logger.go) | ~120 |
| Rust | [`rust/src/lib.rs`](../../rust/src/lib.rs) | ~130 (sem o módulo de teste inline) |

Pequenas o suficiente para serem lidas inteiras em 5 minutos cada.

## Fim do manual

Voltar ao [índice](README.md) · [Issues](https://github.com/jonathascordeiro20/openinfra-logger/issues) · [Discussions](https://github.com/jonathascordeiro20/openinfra-logger/discussions)
