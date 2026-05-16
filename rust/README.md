# openinfra-logger (Rust)

[![Crates.io](https://img.shields.io/crates/v/openinfra-logger?style=flat-square)](https://crates.io/crates/openinfra-logger)
[![docs.rs](https://img.shields.io/docsrs/openinfra-logger?style=flat-square)](https://docs.rs/openinfra-logger)
[![License](https://img.shields.io/crates/l/openinfra-logger?style=flat-square)](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/LICENSE)

**OpenInfra Logger** — zero-dependency, RFC 8259-compliant structured logging. The same JSON shape is emitted by sibling implementations for **Node.js, Python and Go**, so polyglot stacks see a single, consistent log format.

## Install

```toml
[dependencies]
openinfra-logger = "0.1"
```

## Quickstart

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

fn main() {
    let logger = Logger::new(Config::default());
    let mut md = HashMap::new();
    md.insert("user_id".to_string(), "u_8821".to_string());
    md.insert("card".to_string(), "4111-1111-1111-1111".to_string());

    logger.log("order.placed", "info", md);
    // → {"timestamp":"…","level":"info","message":"order.placed","user_id":"u_8821","card":"4111-1111-1111-1111"}
}
```

## Configuration

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

let mut defaults = HashMap::new();
defaults.insert("service".to_string(), "payment-gateway".to_string());

let cfg = Config {
    transports: vec!["console".to_string(), "file".to_string()],
    file_path: "./production.log".to_string(),
    default_metadata: defaults,
};

let logger = Logger::new(cfg);
logger.log("Payment processed", "info", HashMap::new());
```

## Why zero-dependency

This crate compiles with **no transitive crates** — only `std`. The trade-off:

- ✅ Faster compile, smaller binaries, no supply-chain surface, no `serde` version churn
- ✅ Works in `no_std`-adjacent environments after minimal porting
- ⚠️ The JSON builder is hand-rolled but RFC 8259-compliant (quotes, backslashes, control chars all escaped)
- ⚠️ Metadata values are `String` in this version; structured/typed values land in 0.2.

## Links

- **Source** — <https://github.com/jonathascordeiro20/openinfra-logger>
- **Project site** — <https://openinfralogger.fun>
- **Changelog** — <https://github.com/jonathascordeiro20/openinfra-logger/blob/main/CHANGELOG.md>

## License

MIT — see [LICENSE](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/LICENSE).
