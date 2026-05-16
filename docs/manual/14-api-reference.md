# 14 · API reference

[← back to manual index](README.md)

Complete and exact signatures of the public APIs, per runtime, for v0.1.0.

## Node.js

```js
const { log, configure, LEVELS } = require('@jonathascordeiro20/openinfra-logger');
```

### `log(message, level, metadata)`

```
log(message: string, level?: string, metadata?: object): void
```

| Parameter | Type | Default | Behavior |
|---|---|---|---|
| `message` | `string` | — | Required. Free text, **not** redacted |
| `level` | `string` | `'info'` | `debug`/`info`/`warn`/`error` (case-insensitive). Others become `info` |
| `metadata` | `object` | `{}` | Arbitrary JSON-serializable fields. Redaction applied recursively |

Returns nothing. Does not throw in normal flow — internal errors go to `console.error` and the process continues.

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

Semantics: **merge** with the previous config. You can call it multiple times; only fields you pass change.

### `LEVELS`

```js
const { LEVELS } = require('@jonathascordeiro20/openinfra-logger');
// LEVELS === { debug: 10, info: 20, warn: 30, error: 40 }
```

Useful for numeric comparisons if you want to filter at consumption time. OIL **does not filter** internally.

## Python

```python
from openinfra_logger import log, configure, redact_object
```

### `log(message, level='info', metadata=None)`

```
log(message: str, level: str = 'info', metadata: dict | None = None) -> None
```

Identical to Node in semantics. `metadata=None` is treated as `{}` — you can omit it.

### `configure(**kwargs)`

Keyword-only arguments (snake_case):

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

Defaults identical to Node. Merge via `dict.update`.

### `redact_object(obj, keys_to_redact)`

```
redact_object(obj: Any, keys_to_redact: list[str]) -> Any
```

The pure redaction function, exposed for tests and direct use. You don't call it in the normal flow.

## Go

```go
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"
```

### `func Log(message string, level string, metadata map[string]interface{})`

```
openinfralogger.Log(
    message string,
    level string,
    metadata map[string]interface{},  // may be nil
)
```

No return value. Internal errors go to `log.Printf` on stderr.

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

**Heads up:** `Configure` replaces the whole struct. Always pass **every** field you want to keep. Zero-value fields (`""`, `nil`) overwrite the defaults.

`RedactKeys`, `BatchSize`, `FlushIntervalMs` are not yet in the Go implementation — they land in v0.2.

## Rust

```rust
use openinfra_logger::{Logger, Config, escape_json_string, build_json_line};
use std::collections::HashMap;
```

### `Logger::new(config) -> Logger`

```rust
pub fn new(config: Config) -> Self
```

Creates a Logger instance. Multiple loggers can coexist with different configs (no global singleton).

### `Logger::log(&self, message, level, metadata)`

```rust
pub fn log(&self, message: &str, level: &str, metadata: HashMap<String, String>)
```

No return value. I/O failures are silent.

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

`formatter`, `redact_keys`, `remote_url` are not exposed in Rust v0.1 — they land in v0.2.

### Public helper functions (pure, testable)

```rust
pub fn escape_json_string(s: &str) -> String
```

Escapes a string for safe inclusion as a JSON string value (RFC 8259-compliant). Exposed for direct use if you need to build partial JSON outside the Logger.

```rust
pub fn build_json_line(
    message: &str,
    level: &str,
    timestamp_secs: u64,
    default_metadata: &HashMap<String, String>,
    metadata: &HashMap<String, String>,
) -> String
```

Builds the JSON line exactly as the Logger emits. Useful for deterministic tests with injected timestamp.

## CLI — log analyzer

Not a library API — a script:

```bash
npm run analyze <log-file> [-- <flags>]
```

Flags:

| Flag | Behavior |
|---|---|
| none | 7-layer local analysis, zero network |
| `--llm=anthropic` | Cloud Claude (needs `ANTHROPIC_API_KEY`) |
| `--llm=ollama` | Local LLM via Ollama (`OLLAMA_HOST`, `OLLAMA_MODEL`) |
| `--llm=openai` | OpenAI-compatible (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`) |
| `--prompt-only` | Prints the prompt for manual paste into a chat |
| `--help` or `-h` | Shows every flag and env var |

Exit codes:

- `0` — success, no errors found, or prompt-only print
- `1` — file not found, network failure (in `--llm=*` mode), API error
- `2` — unknown flag

## Semver changes

All public APIs listed above are **stable** within a major version. Breaking changes to any of them require a major bump:

- Renaming `log` → `oilLog` would be 2.0
- Changing `configure()` to return the resolved config would be 2.0
- Adding an optional field to `Config` (Rust) is 0.2 (minor)
- Adding an exposed `flush()` is 0.2 (minor)
- A bug fix that changes observable documented behavior may be 0.1.1 (patch) or 0.2 (minor) depending on severity

Criterion: the official tests and canonical documentation in v0.1.0 are the "contract". Changes that invalidate existing tests are breaking.

## Where each implementation lives

| Runtime | Main file | Lines |
|---|---|---|
| Node | [`src/index.js`](../../src/index.js) | ~200 |
| Python | [`python/openinfra_logger/__init__.py`](../../python/openinfra_logger/__init__.py) | ~200 |
| Go | [`go/logger.go`](../../go/logger.go) | ~120 |
| Rust | [`rust/src/lib.rs`](../../rust/src/lib.rs) | ~130 (excluding the inline test module) |

Small enough to read in full in 5 minutes each.

## End of manual

Back to the [index](README.md) · [Issues](https://github.com/jonathascordeiro20/openinfra-logger/issues) · [Discussions](https://github.com/jonathascordeiro20/openinfra-logger/discussions)
