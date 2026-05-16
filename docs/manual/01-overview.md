# 01 · Overview

[← back to manual index](README.md)

## In one sentence

OpenInfra Logger emits **a single structured JSON shape across Node.js, Python, Go, and Rust**, with no external dependencies in any of the four implementations.

## Who it's for

- **Polyglot teams** that run services in two or more of the four languages and lose hours during incidents lining up schemas in Datadog or Elastic.
- **SREs** who want a canonical shape that drops straight into any pipeline (file → fluent-bit → Loki, or stdout → Datadog agent, etc.) without transformers in the way.
- **Applications subject to LGPD / GDPR** that need to guarantee `password`, `token`, `api_key`, `secret`, and `credit_card` **never** leave the process unredacted.
- **People tired of their logger pulling in 30 transitive deps** who prefer a smaller surface to maintain and audit.

## Who it's **not** for

- **Apps that need 100k+ events/second/process in Node** — Pino is still the answer. OIL sits around 10k events/s/proc in the default config — enough for ~99% of APIs, not enough for synchronous data pipelines.
- **Anyone who needs pretty colorized dev output** — output is JSON, period. Pipe to `jq -C` if you want color.
- **Anyone who needs redaction by value (not by field name)** — v0.1 redacts by key name. Semantic detection (regex on values) is on the roadmap.
- **Anyone who wants a backend** — OIL is a client. You still need Datadog, Elastic, Loki, CloudWatch, or somewhere to receive logs.

## What v0.1.0 delivers

| Capability | Node | Python | Go | Rust |
|---|---|---|---|---|
| Structured JSON | ✓ | ✓ | ✓ | ✓ |
| Console transport | ✓ | ✓ | ✓ | ✓ |
| File transport | ✓ ordered | ✓ | ✓ | ✓ |
| Remote HTTP transport | ✓ batched | ✓ batched | ✓ fire-and-forget | — |
| Datadog formatter | ✓ | ✓ | ✓ | — |
| Elastic (ECS) formatter | ✓ | ✓ | ✓ | — |
| Auto-redaction | ✓ recursive | ✓ recursive | — | — |
| OpenTelemetry injection | ✓ auto | ✓ auto | — | — |
| Log analyzer CLI | ✓ via npm script (works on logs from any runtime) |

The "—" markers are documented gaps in v0.1.0 and are on the v0.2 roadmap.

## The canonical JSON contract

```json
{
  "timestamp":   "2026-05-16T03:42:01.041Z",
  "level":       "info",
  "message":     "order.placed",
  "service":     "checkout-api",
  "env":         "production",
  "trace_id":    "a4f1c9d3...",
  "span_id":     "b3d8e2f7...",
  "user_id":     "u_8821"
}
```

Every implementation emits this shape. More detail in [02 · Concepts](02-concepts.md).

## What makes this project **different**

- **Same JSON across four languages.** Not "compatible" — identical. You can parse logs from a Go worker and a Node front-end with the same schema.
- **Zero package-manager deps.** No `npm install` pulls anything else; no `pip install` brings transitive deps. Each implementation uses only the language's stdlib.
- **Redaction before the transport.** Other libs redact at the edge (in fluentd, in the agent). OIL redacts inside the process, before any write. Logs on disk are already redacted.
- **Local triage before the AI.** The analyzer runs 7 layers of analysis (clusters, heuristics, cascades, anomalies) with no network call. AI is explicit opt-in, and three providers are supported: Anthropic (cloud), Ollama (local), OpenAI-compatible.

## What may stay out of scope (forever)

- **Multi-tenant log routing**, **structured tracing primitives**, **metrics emission** — other projects (OpenTelemetry SDK, Prometheus client) do those better. OIL does logs.
- **Pretty printers / TUI** — JSON in, JSON out. Use `jq`, `pino-pretty`, `bunyan`, or any other pretty-printer at consumption time.
- **Persistent buffer / disk WAL** — if you need a guarantee that no log is lost when the process dies, use a dedicated shipper (Vector, fluent-bit) between the process and the backend.

## Next

→ [02 · Concepts](02-concepts.md) — understand the JSON contract, the architecture, and where the "zero deps" claim stops.
