# OpenInfra Logger — Manual

> Complete manual for v0.1.0. For a 5-minute quickstart per runtime, see [`docs/quickstart-node.md`](../quickstart-node.md), [`docs/quickstart-python.md`](../quickstart-python.md), [`docs/quickstart-go.md`](../quickstart-go.md), or [`docs/quickstart-rust.md`](../quickstart-rust.md).

## Table of contents

1. [Overview](01-overview.md) — who it's for, what it ships, on one page
2. [Concepts](02-concepts.md) — the canonical JSON shape, the architecture, the design choices
3. [Installation](03-installation.md) — Node, Python, Go, Rust, minimum versions, verification
4. [Configuration](04-configuration.md) — every field, every default, runtime-by-runtime gotchas
5. [Transports](05-transports.md) — `console`, `file`, `remote`; ordering, batching, failures
6. [Formatters](06-formatters.md) — `default`, `datadog`, `elastic`; field-by-field mapping
7. [Auto-redaction](07-redaction.md) — recursive algorithm, customization, edge cases
8. [OpenTelemetry](08-opentelemetry.md) — automatic `trace_id`/`span_id` injection
9. [Log analyzer](09-analyzer.md) — local mode (7 layers), LLM mode (3 providers)
10. [Performance](10-performance.md) — benchmarks, tuning, hot-path notes
11. [Migration guides](11-migration.md) — coming from Pino, Winston, structlog, zap
12. [Troubleshooting](12-troubleshooting.md) — common symptoms and fixes
13. [FAQ](13-faq.md) — questions that always come back
14. [API reference](14-api-reference.md) — exact signatures per runtime

## Where to find what

| I want to… | Go to |
|---|---|
| Install and emit the first line | [Installation](03-installation.md) + your runtime's quickstart |
| Choose between `formatter: datadog` and `elastic` | [Formatters](06-formatters.md) |
| Make sure `password` never leaks | [Redaction](07-redaction.md) |
| Tie my telemetry to an OTel span | [OpenTelemetry](08-opentelemetry.md) |
| Triage error logs in production | [Log analyzer](09-analyzer.md) |
| Leave Pino without rewriting the app | [Migration → from Pino](11-migration.md#from-pino-node) |
| Understand why `level: 'verbose'` becomes `'info'` | [Configuration → log levels](04-configuration.md#log-levels) |
| Ensure file writes don't interleave lines | [Transports → file ordering](05-transports.md#ordering-under-concurrent-writes) |
| Know exactly where the `0 deps` claim stops and what it does NOT promise | [Concepts → zero-dependency claim](02-concepts.md#zero-dependency-claim) |
| Report a bug or propose a feature | [Contributing](../../CONTRIBUTING.md) + [Issues](https://github.com/jonathascordeiro20/openinfra-logger/issues) |

## Conventions used in this manual

- Install commands (`npm i …`, `pip install …`, `cargo add …`, `go get …`) use the final names published in each registry.
- ASCII diagrams stay ≤ 80 columns wide so they read well in pull requests.
- When a behavior is **identical across all four runtimes**, the example is shown in one runtime with parity explicitly stated. When behavior diverges, the four runtimes appear side by side.
- "Hot path" means code that runs on every `log()` call. "Cold path" means setup, configuration, and exit handlers.

## Versions covered

- **OpenInfra Logger** — `v0.1.0` (the first public release)
- **Node.js** — ≥ 16, tested on 24
- **Python** — ≥ 3.8, tested on 3.12
- **Go** — ≥ 1.20, tested on 1.26
- **Rust** — ≥ 1.70, tested on 1.95

Older versions may work but are not part of the CI matrix.
