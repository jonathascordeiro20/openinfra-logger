# Changelog

All notable changes to OpenInfra Logger will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-15

### Added
- **Node.js implementation** (`src/index.js`) — console / file / remote transports, structured JSON output, log levels (`debug` / `info` / `warn` / `error`), default metadata merging.
- **Python implementation** (`python/openinfra_logger/`) — feature parity with Node.
- **Go implementation** (`go/logger.go`) — feature parity with Node and Python.
- **Rust implementation** (`rust/src/lib.rs`) — zero-dependency JSON builder, file + console transports.
- **Auto-redaction** — sensitive keys (`password`, `token`, `secret`, `api_key`, `credit_card`) recursively replaced with `[REDACTED]` before any transport sees the entry. Case-insensitive on keys; configurable via `redactKeys` / `redact_keys`.
- **Remote batching transport** — Node and Python ship logs in batches (default 100 entries or 2 s, whichever first) instead of HTTP-per-log; survives endpoint failures without crashing the host process.
- **OpenTelemetry context injection** — when an active span is present, `trace_id` and `span_id` are extracted automatically (no extra `import`).
- **Datadog formatter** — renames `level` → `status`, `trace_id` → `dd.trace_id`, `span_id` → `dd.span_id`.
- **Elastic / ECS formatter** — renames `timestamp` → `@timestamp`, `level` → `log.level`.
- **AI root-cause analyzer** (`tools/ai-analyzer.js`) — parses error files, packages them as a prompt for the Anthropic Claude API, prints structured remediation. Falls back to a copy-paste-able prompt when `ANTHROPIC_API_KEY` is not set.
- **Test matrix** — 69 tests across the four runtimes (Node 32, Python 22, Go 8, Rust 7) covering redaction, levels, transports, formatters, batching triggers, and JSON escaping.
- **Examples** — Express integration, security logging, Datadog integration, OpenTelemetry tracing, basic usage in Node / Python / Go / Rust.
- **Documentation** — installation, architecture, integration, advanced configuration under `docs/`.
- **CI workflow** and release automation under `.github/workflows/`.

### Fixed
- **Node** — invalid log levels were being emitted verbatim in the JSON because the fallback to `'info'` updated the wrong variable. The emitted entry now correctly contains `"level":"info"` when the caller passes an unsupported level.
- **Node** — concurrent `fs.appendFile` calls could interleave lines under bursty writes. Writes are now serialized through an internal promise chain, preserving emission order.
- **Python** — replaced 5 occurrences of the deprecated `datetime.datetime.utcnow()` with a forward-compatible helper that emits ISO-8601 UTC with a trailing `Z`. No more `DeprecationWarning` on Python 3.12+.
- **Rust** — the manual JSON builder did not escape `"`, `\`, control characters or newlines in messages or metadata, producing invalid JSON whenever user input contained any of them. Introduced `escape_json_string()` and a pure `build_json_line()` function (RFC 8259-compliant). Crate remains dependency-free.

### Security
- **LGPD / GDPR** — auto-redaction is on by default; disabling it requires an explicit `redactKeys: []` in the configuration.

[Unreleased]: https://github.com/jonathascordeiro20/openinfra-logger/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jonathascordeiro20/openinfra-logger/releases/tag/v0.1.0
