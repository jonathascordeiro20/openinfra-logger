# 03 · Installation

[← back to manual index](README.md)

## Exact command per runtime

### Node.js (≥ 16)

```bash
npm install @jonathascordeiro20/openinfra-logger
# or:
yarn add @jonathascordeiro20/openinfra-logger
# or:
pnpm add @jonathascordeiro20/openinfra-logger
```

Verify:

```bash
node -e "const { log } = require('@jonathascordeiro20/openinfra-logger'); log('install ok', 'info', { check: true })"
# → {"timestamp":"...","level":"info","message":"install ok","check":true}
```

### Python (≥ 3.8)

```bash
pip install openinfra-logger
```

With optional OpenTelemetry support (required if you want `trace_id`/`span_id` auto-injected):

```bash
pip install "openinfra-logger[opentelemetry]"
```

Verify:

```bash
python -c "from openinfra_logger import log; log('install ok', 'info', {'check': True})"
# → {"timestamp":"...","level":"info","message":"install ok","check":true}
```

### Go (≥ 1.20)

```bash
go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0
```

> **Important (module in subpath):** because the package lives under `/go/`, the published tag is `go/v0.1.0`, not just `v0.1.0`. Use the full module path (`.../openinfra-logger/go`) and the tag resolves correctly.

Verify:

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

Verify:

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

## When one of the steps fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install ... E404` | wrong scope in the name | Verify the `@jonathascordeiro20/` prefix |
| `pip install ... could not find a version` | pip too old (< 21) | `python -m pip install --upgrade pip` |
| `go get ... unknown revision v0.1.0` | missing subpath tag | Use `@v0.1.0` (not `@latest`) and the path ending in `/go` |
| `cargo add` fails with "name has been claimed" | your Cargo is targeting an alternate registry | `cargo add openinfra-logger --registry crates-io` |
| Rust compile fails on `edition = "2021"` | toolchain < 1.56 | `rustup update` |

## Minimum versions and CI matrix

| Runtime | Minimum supported | Latest tested in CI |
|---|---|---|
| Node.js | 16 | 24 |
| Python | 3.8 | 3.12 |
| Go | 1.20 | 1.26 |
| Rust | 1.70 | 1.95 |

Older versions may work but receive no attention. Newer versions are usually covered within 1–2 releases.

## Where the library does **not** run (yet)

- **Bun** — works via Node API shims, but it's not part of the CI matrix. Reports are welcome.
- **Deno** — untested. In theory the subset of `node:fs` we use works in Deno 1.40+.
- **Cloudflare Workers / Edge** — does not work: we depend on `fs.appendFile` for the file transport. In Workers, use only `console` + `remote`. [PRs welcome](https://github.com/jonathascordeiro20/openinfra-logger/issues) for an edge-only build.
- **WASM** — the Rust crate works on `wasm32-wasi` except for the file transport.

## Uninstall

```bash
npm uninstall @jonathascordeiro20/openinfra-logger
pip uninstall openinfra-logger
cargo remove openinfra-logger
go mod edit -droprequire github.com/jonathascordeiro20/openinfra-logger/go && go mod tidy
```

## Next

→ [04 · Configuration](04-configuration.md) — every field of `configure()` per runtime, with defaults and gotchas.
