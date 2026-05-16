# OpenInfra Logger — Python

[![PyPI](https://img.shields.io/pypi/v/openinfra-logger?style=flat-square)](https://pypi.org/project/openinfra-logger/)
[![License](https://img.shields.io/pypi/l/openinfra-logger?style=flat-square)](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/LICENSE)
[![Python Versions](https://img.shields.io/pypi/pyversions/openinfra-logger?style=flat-square)](https://pypi.org/project/openinfra-logger/)

**OpenInfra Logger** is a zero-dependency, structured logging library — built from the Python standard library only — with native batching, auto-redaction, OpenTelemetry trace injection, and Datadog/Elastic formatters.

The same JSON shape is emitted by sibling implementations for **Node.js, Go and Rust**, making polyglot stacks observable with a single log format.

## Install

```bash
pip install openinfra-logger
```

## Quickstart

```python
from openinfra_logger import log, configure

log("System initialized", "info")
log("Failed to parse payload", "error", {"request_id": "abc-123"})
```

## File + remote with batching

```python
from openinfra_logger import log, configure

configure(
    transports=["console", "file", "remote"],
    file_path="./production.log",
    remote_url="https://logs.my-infrastructure.com/ingest",
    default_metadata={"service": "payment-gateway", "env": "production"},
    batch_size=100,
    flush_interval_ms=2000,
)

log("Payment processed", "info", {"transaction_id": "abc-456"})
```

## Datadog / Elastic formatters

```python
configure(formatter="datadog")   # renames level → status, trace_id → dd.trace_id
# configure(formatter="elastic") # renames timestamp → @timestamp, level → log.level
```

## Auto-redaction (LGPD / GDPR)

Sensitive keys (`password`, `token`, `secret`, `api_key`, `credit_card`) are recursively replaced with `[REDACTED]` before any transport sees the entry. Case-insensitive on key names. Override via `redact_keys=[...]` in `configure(...)`.

```python
log("Login", "info", {"user": "alice", "password": "p@ss"})
# → "...","user":"alice","password":"[REDACTED]"
```

## OpenTelemetry tracing

If an OTel span is active in the current context, `trace_id` and `span_id` are picked up automatically. Install the optional extra to enable detection:

```bash
pip install "openinfra-logger[opentelemetry]"
```

## Links

- **Source** — <https://github.com/jonathascordeiro20/openinfra-logger>
- **Issues** — <https://github.com/jonathascordeiro20/openinfra-logger/issues>
- **Changelog** — <https://github.com/jonathascordeiro20/openinfra-logger/blob/main/CHANGELOG.md>
- **Project site** — <https://openinfralogger.fun>

## License

MIT — see [LICENSE](https://github.com/jonathascordeiro20/openinfra-logger/blob/main/LICENSE).
