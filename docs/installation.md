# Installation

OpenInfra Logger ships native for **Node.js, Python, Go and Rust**. Every runtime is **zero-dependency** — the package only uses the language's standard library.

## Node.js

```bash
npm install @jonathascordeiro20/openinfra-logger
# or
yarn add @jonathascordeiro20/openinfra-logger
# or
pnpm add @jonathascordeiro20/openinfra-logger
```

Requires Node.js ≥ 16. CommonJS today; ESM in 0.2.

```js
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');
log('hello', 'info');
```

## Python

```bash
pip install openinfra-logger
# with the optional OpenTelemetry hook:
pip install "openinfra-logger[opentelemetry]"
```

Requires Python ≥ 3.8.

```python
from openinfra_logger import log
log("hello", "info")
```

## Go

```bash
go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0
```

Requires Go ≥ 1.20.

```go
import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"

openinfralogger.Log("hello", "info", nil)
```

## Rust

```toml
# Cargo.toml
[dependencies]
openinfra-logger = "0.1"
```

Requires Rust ≥ 1.70.

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

let logger = Logger::new(Config::default());
logger.log("hello", "info", HashMap::new());
```

## Verify the install

A working install prints a single JSON line to stdout:

```text
{"timestamp":"2026-05-15T13:42:01.041Z","level":"info","message":"hello"}
```

If you see additional fields like `service` or `trace_id`, that's metadata you (or an active OpenTelemetry span) supplied — not noise from the library.

## Upgrading

| From | To | Steps |
|---|---|---|
| Pre-0.1 (git clone) | 0.1.0 | Switch to the package manager install above; the public API is unchanged |

## What's NOT installed

The library has zero transitive dependencies. After `npm install` / `pip install` / `cargo add`, you will **not** see:

- a flood of indirect packages in your lockfile
- a `node_modules` larger than the average React component
- a transitive vulnerability advisory next month

This is intentional. See [docs/architecture.md](architecture.md) for the design rationale.
