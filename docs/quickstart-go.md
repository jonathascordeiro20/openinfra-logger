# Quickstart — Go

A 5-minute introduction.

## Install

```bash
go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0
```

## 1. Your first log

```go
package main

import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"

func main() {
    openinfralogger.Log("Server started", "info", nil)
    openinfralogger.Log("Failed to parse payload", "error", map[string]interface{}{
        "request_id": "abc-123",
    })
}
```

## 2. Default metadata

```go
openinfralogger.Configure(openinfralogger.Config{
    Transports:    []string{"console"},
    Formatter:     "default",
    RemoteHeaders: map[string]string{},
    DefaultMetadata: map[string]interface{}{
        "service": "checkout-api",
        "env":     "production",
    },
})

openinfralogger.Log("Order created", "info", map[string]interface{}{
    "order_id": "o_4419",
})
```

## 3. File transport

```go
openinfralogger.Configure(openinfralogger.Config{
    Transports:      []string{"console", "file"},
    FilePath:        "./production.log",
    Formatter:       "default",
    RemoteHeaders:   map[string]string{},
    DefaultMetadata: map[string]interface{}{"service": "checkout-api"},
})
```

## 4. Datadog or Elastic

```go
// Datadog
openinfralogger.Configure(openinfralogger.Config{
    Transports:    []string{"console"},
    Formatter:     "datadog",
    RemoteHeaders: map[string]string{},
    DefaultMetadata: map[string]interface{}{},
})

// Elastic
openinfralogger.Configure(openinfralogger.Config{
    Transports:    []string{"console"},
    Formatter:     "elastic",
    RemoteHeaders: map[string]string{},
    DefaultMetadata: map[string]interface{}{},
})
```

## 5. HTTP middleware (standard library)

```go
package main

import (
    "net/http"
    "time"

    openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"
)

func withLogging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rec := &statusRecorder{ResponseWriter: w, status: 200}
        next.ServeHTTP(rec, r)
        openinfralogger.Log("request", "info", map[string]interface{}{
            "method":      r.Method,
            "path":        r.URL.Path,
            "status":      rec.status,
            "duration_ms": time.Since(start).Milliseconds(),
        })
    })
}

type statusRecorder struct {
    http.ResponseWriter
    status int
}

func (s *statusRecorder) WriteHeader(code int) {
    s.status = code
    s.ResponseWriter.WriteHeader(code)
}

func main() {
    openinfralogger.Configure(openinfralogger.Config{
        Transports:      []string{"console"},
        Formatter:       "default",
        RemoteHeaders:   map[string]string{},
        DefaultMetadata: map[string]interface{}{"service": "api"},
    })
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
        w.Write([]byte(`{"ok":true}`))
    })
    http.ListenAndServe(":3000", withLogging(mux))
}
```

## Caveats (current 0.1.0)

- `Configure` **replaces** the full struct — pass all fields you care about (including `DefaultMetadata: map[string]interface{}{}` if you don't want one).
- Remote transport (fire-and-forget HTTP POST) sends one entry per request in this release; native batching is planned for the Go implementation in a follow-up.
- OpenTelemetry trace injection is not yet wired in Go — coming next release.

## Where to go next

- [docs/integration.md](integration.md) — Datadog, Elastic, Loki wiring
- [examples/go-basic-usage.go](../examples/go-basic-usage.go) — runnable sample
- [pkg.go.dev](https://pkg.go.dev/github.com/jonathascordeiro20/openinfra-logger/go) — generated API reference
