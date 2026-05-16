# Quickstart — Rust

A 5-minute introduction.

## Install

```toml
# Cargo.toml
[dependencies]
openinfra-logger = "0.1"
```

The crate compiles with no transitive crates — only `std`.

## 1. Your first log

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

fn main() {
    let logger = Logger::new(Config::default());
    logger.log("Server started", "info", HashMap::new());

    let mut md = HashMap::new();
    md.insert("request_id".to_string(), "abc-123".to_string());
    logger.log("Failed to parse payload", "error", md);
}
```

Output:

```text
{"timestamp":"1747391521","level":"info","message":"Server started"}
{"timestamp":"1747391521","level":"error","message":"Failed to parse payload","request_id":"abc-123"}
```

> **Timestamp note (0.1.0)** — the Rust implementation currently emits a Unix-seconds integer. ISO-8601 (matching the other runtimes) lands in 0.2.

## 2. Default metadata

```rust
use openinfra_logger::{Logger, Config};
use std::collections::HashMap;

let mut defaults = HashMap::new();
defaults.insert("service".to_string(), "checkout-api".to_string());
defaults.insert("env".to_string(),     "production".to_string());

let cfg = Config {
    transports: vec!["console".to_string()],
    file_path: "./app.log".to_string(),
    default_metadata: defaults,
};

let logger = Logger::new(cfg);
logger.log("Order created", "info", HashMap::from([
    ("order_id".to_string(), "o_4419".to_string()),
]));
```

## 3. File transport

```rust
let cfg = Config {
    transports: vec!["console".to_string(), "file".to_string()],
    file_path: "./production.log".to_string(),
    default_metadata: HashMap::new(),
};
let logger = Logger::new(cfg);
logger.log("Audit", "info", HashMap::new());
```

## 4. Zero-dependency JSON escaping

The crate ships an RFC 8259-compliant escaper for the message and every metadata value, so this just works:

```rust
let mut md = HashMap::new();
md.insert("key".to_string(), r#"value with "quotes" and \backslash"#.to_string());
logger.log("special chars", "info", md);
// → "key":"value with \"quotes\" and \\backslash"
```

## Caveats (current 0.1.0)

- Metadata values are `String` only. Numbers, booleans and nested structures land in 0.2 with a `Value` enum.
- No remote / batched transport in this release.
- No OpenTelemetry hook yet (planned for 0.2).
- No formatter switch yet (the Datadog / Elastic remappings are Node/Python only in 0.1).

These are all on the roadmap and prioritized by issue volume — open an issue if you need any of them sooner.

## Where to go next

- [docs/architecture.md](architecture.md) — why we hand-rolled the JSON builder
- [examples/rust-basic-usage.rs](../examples/rust-basic-usage.rs) — runnable sample
- [docs.rs/openinfra-logger](https://docs.rs/openinfra-logger) — generated API reference
