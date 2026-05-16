# 03 · Instalação

[← back to manual index](README.md)

## Comando exato por runtime

### Node.js (≥ 16)

```bash
npm install @jonathascordeiro20/openinfra-logger
# or:
yarn add @jonathascordeiro20/openinfra-logger
# or:
pnpm add @jonathascordeiro20/openinfra-logger
```

Verificação:

```bash
node -e "const { log } = require('@jonathascordeiro20/openinfra-logger'); log('install ok', 'info', { check: true })"
# → {"timestamp":"...","level":"info","message":"install ok","check":true}
```

### Python (≥ 3.8)

```bash
pip install openinfra-logger
```

Com OpenTelemetry opcional (necessário se você quer que `trace_id`/`span_id` sejam detectados automaticamente):

```bash
pip install "openinfra-logger[opentelemetry]"
```

Verificação:

```bash
python -c "from openinfra_logger import log; log('install ok', 'info', {'check': True})"
# → {"timestamp":"...","level":"info","message":"install ok","check":true}
```

### Go (≥ 1.20)

```bash
go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0
```

> **Importante (módulo em subpath):** porque o package vive em `/go/`, a tag publicada é `go/v0.1.0`, não apenas `v0.1.0`. Use o módulo path completo (`.../openinfra-logger/go`) e a tag funciona corretamente.

Verificação:

```bash
cat > /tmp/check.go <<'EOF'
package main
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"
func main() {
  openinfralogger.Log("install ok", "info", map[string]interface{}{"check": true})
}
EOF
cd /tmp && go mod init check && go mod tidy && go run check.go
# → {"timestamp":"...","level":"info","message":"install ok","check":true}
```

### Rust (≥ 1.70)

```toml
# Cargo.toml
[dependencies]
openinfra-logger = "0.1"
```

Verificação:

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

fn main() {
    let logger = Logger::new(Config::default());
    let mut md = HashMap::new();
    md.insert("check".to_string(), "true".to_string());
    logger.log("install ok", "info", md);
}
```

## Quando algum dos passos falha

| Sintoma | Provável causa | Correção |
|---|---|---|
| `npm install ... E404` | escopo errado no nome | Confira o `@jonathascordeiro20/` no início |
| `pip install ... could not find a version` | pip muito antigo (< 21) | `python -m pip install --upgrade pip` |
| `go get ... unknown revision v0.1.0` | tag de subpath ausente | Use `@v0.1.0` (não `@latest`) e o path com `/go` no fim |
| `cargo add` falha por `name has been claimed` | seu Cargo está olhando um registry alternativo | `cargo add openinfra-logger --registry crates-io` |
| Compilação Rust falha por `edition = "2021"` | toolchain < 1.56 | `rustup update` |

## Versões mínimas e a matriz de CI

| Runtime | Mínima suportada | Última testada em CI |
|---|---|---|
| Node.js | 16 | 24 |
| Python | 3.8 | 3.12 |
| Go | 1.20 | 1.26 |
| Rust | 1.70 | 1.95 |

Versões mais antigas podem funcionar mas não recebem atenção. Versões mais novas costumam ser cobertas em até 1–2 releases após o lançamento.

## Onde a lib **não** roda (ainda)

- **Bun** — funciona via shims de Node API, mas não é parte da matriz de CI. Reports são bem-vindos.
- **Deno** — não testado. Em teoria o subset de `node:fs` que usamos funciona em Deno 1.40+.
- **Cloudflare Workers / Edge** — não funciona: dependemos de `fs.appendFile` para o file transport. Em Workers, use só `console` + `remote`. Issue [aceita PRs](https://github.com/jonathascordeiro20/openinfra-logger/issues) para um build edge-only.
- **WASM** — Rust crate funciona em `wasm32-wasi` exceto pelo file transport.

## Desinstalar

```bash
npm uninstall @jonathascordeiro20/openinfra-logger
pip uninstall openinfra-logger
cargo remove openinfra-logger
go mod edit -droprequire github.com/jonathascordeiro20/openinfra-logger/go && go mod tidy
```

## Próximo passo

→ [04 · Configuração](04-configuration.md) — todos os campos do `configure()` por runtime, com defaults e gotchas.
