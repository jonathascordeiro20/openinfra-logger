# Quickstart — Python

A 5-minute introduction. By the end you'll have structured logs hitting stdout, a file, and a remote endpoint, with sensitive fields automatically redacted.

## Install

```bash
pip install openinfra-logger
# with the optional OpenTelemetry hook:
pip install "openinfra-logger[opentelemetry]"
```

## 1. Your first log

```python
from openinfra_logger import log

log("Server started", "info")
log("Failed to parse payload", "error", {"request_id": "abc-123"})
```

Output:

```text
{"timestamp":"2026-05-15T13:42:01.041Z","level":"info","message":"Server started"}
{"timestamp":"2026-05-15T13:42:01.058Z","level":"error","message":"Failed to parse payload","request_id":"abc-123"}
```

## 2. Default metadata

```python
from openinfra_logger import log, configure
import os

configure(default_metadata={
    "service": "checkout-api",
    "env": os.getenv("APP_ENV", "dev"),
})

log("Order created", "info", {"order_id": "o_4419"})
# → "service":"checkout-api","env":"production","order_id":"o_4419"
```

## 3. Multiple transports

```python
configure(
    transports=["console", "file", "remote"],
    file_path="./production.log",
    remote_url="https://logs.my-infrastructure.com/ingest",
    default_metadata={"service": "checkout-api"},
    batch_size=100,
    flush_interval_ms=2000,
)
```

## 4. Auto-redaction

```python
log("login attempt", "info", {
    "user": "alice",
    "password": "p@ss",
    "token": "xyz",
})
# → "user":"alice","password":"[REDACTED]","token":"[REDACTED]"
```

Override the redact list:

```python
configure(redact_keys=["password", "token", "secret", "api_key", "credit_card", "ssn"])
```

## 5. Datadog or Elastic

```python
configure(formatter="datadog")
# → "status":"info" (instead of "level"), "dd.trace_id":"…"

configure(formatter="elastic")
# → "@timestamp":"…", "log.level":"info"
```

## 6. OpenTelemetry — automatic

If an OTel span is active, `trace_id` and `span_id` are injected automatically:

```python
from opentelemetry import trace
from openinfra_logger import log

tracer = trace.get_tracer("demo")

with tracer.start_as_current_span("process-order"):
    log("processing", "info", {"order_id": "o_4419"})
    # → "trace_id":"a4f1c9…","span_id":"b3d8e2…","order_id":"o_4419"
```

Install the optional extra to enable detection:

```bash
pip install "openinfra-logger[opentelemetry]"
```

## 7. Flask middleware (10 lines)

```python
from flask import Flask, request
from openinfra_logger import log, configure
import time

configure(default_metadata={"service": "api"})

app = Flask(__name__)

@app.before_request
def _start_timer():
    request._oil_started = time.time()

@app.after_request
def _log_response(resp):
    log("request", "info", {
        "method": request.method,
        "path": request.path,
        "status": resp.status_code,
        "duration_ms": int((time.time() - request._oil_started) * 1000),
    })
    return resp

@app.route("/")
def root():
    return {"ok": True}

if __name__ == "__main__":
    app.run(port=3000)
```

## Where to go next

- [docs/advanced-configuration.md](advanced-configuration.md) — every `configure()` option
- [docs/integration.md](integration.md) — Datadog, Elastic, Loki wiring
- [docs/architecture.md](architecture.md) — why stdlib only
- [examples/python-basic-usage.py](../examples/python-basic-usage.py) — runnable sample
