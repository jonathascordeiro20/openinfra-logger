## v0.1.0 — first public release 🎉

> **One log shape. Four runtimes. Zero dependencies.**

OpenInfra Logger ships structured telemetry for **Node.js, Python, Go and Rust**, built from each runtime's standard library. The same JSON shape is emitted across all four, so polyglot stacks see a single, consistent log format on Datadog, Elastic, Loki, or any backend that ingests JSON over file or HTTP.

### Install

| Runtime | Command |
|---|---|
| **Node.js** | `npm install @jonathascordeiro20/openinfra-logger` |
| **Python** | `pip install openinfra-logger` |
| **Go** | `go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0` |
| **Rust** | `cargo add openinfra-logger` |

### What's inside

- **4 runtime implementations** with identical JSON output
- **Auto-redaction** — `password`, `token`, `secret`, `api_key`, `credit_card` are recursively replaced with `[REDACTED]` before any transport sees the entry (LGPD/GDPR-friendly, case-insensitive on keys)
- **Native remote batching** (Node/Python) — buffered transport, ~100× fewer egress requests than log-per-call
- **OpenTelemetry-aware** — `trace_id` and `span_id` are picked up automatically when a span is active
- **Datadog and Elastic (ECS) formatters** — switch the wire payload with one config line
- **AI root-cause analyzer** (`npm run analyze`) — parses local error files and asks Claude for structured remediation
- **69 tests** across all four runtimes (Node 32 · Python 22 · Go 8 · Rust 7)

### Highlights from the test suite

The cross-runtime test matrix uncovered and fixed three production-relevant bugs during this release cycle:

- **Node** — invalid log levels were being emitted verbatim in the JSON; the fallback to `'info'` updated the wrong variable.
- **Node** — concurrent `fs.appendFile` calls could interleave lines under bursty writes. Writes are now serialized through an internal promise chain.
- **Rust** — the manual JSON builder did not escape `"`, `\` or control characters, producing invalid JSON whenever user input contained any of them. Now RFC 8259-compliant.

Full details in [CHANGELOG.md](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/CHANGELOG.md).

### Project links

- **Site** — <https://openinfralogger.fun>
- **Documentation** — [README](https://github.com/jonathascordeiro20/openinfra-logger#readme)
- **Issues** — <https://github.com/jonathascordeiro20/openinfra-logger/issues>

### Distribution artifacts

The wheel + sdist (Python) and `.crate` (Rust) are attached below for inspection. Normal installation should use the package managers above, not these tarballs.

---

MIT licensed. PRs welcome — please see [CONTRIBUTING.md](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/CONTRIBUTING.md). The cross-language parity principle matters: new core features should be considered for all four runtimes.
