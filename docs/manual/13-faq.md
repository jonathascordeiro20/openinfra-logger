# 13 · FAQ

[← back to manual index](README.md)

## Why another logger?

Because no existing logger is **the same thing** in Node, Python, Go, and Rust. Pino is great in Node. structlog is great in Python. zap is great in Go. tracing is great in Rust. But none of the four emits **the same JSON** as the other three. In polyglot teams, that breaks the Datadog correlator on the first postmortem that crosses two languages.

## Isn't it simpler to just standardize with `winston-format-json` or similar?

Yes, **if you only have Node**. No, if you also have Python + Go — you'd end up writing three custom formatters that drift in 18 months. OIL is the infrastructure that writes those three formatters once, audits them once, and updates them once.

## Is "zero dependencies" marketing?

It's not marketing — it's literal in the published packages. But it is a claim **about the dependency tree**, not about network behavior. Details in [Concepts → zero-dependency claim](02-concepts.md#zero-dependency-claim).

## Is redaction safe?

Redaction **prevents leakage in `metadata.value` when the `metadata.key` matches**. It does not detect sensitive values in free text (message, stack trace), does not partial-mask (last-4-digits), and does not run regex over values. Details and pitfalls in [07 · Redaction → anti-leak patterns](07-redaction.md#anti-leak-patterns-in-your-application).

## Why did `level: 'verbose'` become `info`?

The 4 levels are intentionally restricted (`debug`/`info`/`warn`/`error`). Allowing arbitrary levels breaks uniformity across runtimes and forces custom filters on every backend. If you need more granularity, use `metadata.category` or `metadata.severity_detail`.

## Does OIL rotate files?

No. Use `logrotate` (Linux), `multilog` (daemontools), or a shipper (Vector / fluent-bit) that rotates upstream. Rotation inside the logger is a classic source of race conditions and belongs outside the process.

## Does OIL retry remote sends?

Not in v0.1.0. POST failure is log-and-discard. If you need delivery guarantees, place a local shipper in the path. **Loggers should not be a message queue.**

## Can I use OIL with a `pretty-printer`?

Yes — OIL emits JSON in lines, so any pretty-printer works. For dev:

```bash
node app.js | jq .
node app.js | pino-pretty
python app.py | jq .
```

## In production, should I use `console` or `file`?

**`console`** if you have any of:
- Docker + a log driver (`json-file`, `journald`)
- Kubernetes (kubelet collects stdout/stderr)
- Datadog Agent, Vector, fluent-bit on the host

**`file`** if you have:
- Compliance that requires logs on disk
- No collection agent on the host
- A need for fallback when the backend is down

`remote` if you're on serverless or edge with no local agent.

## Does OIL affect my app's performance?

On Node, ~99 µs of p50 per `log()`. For a typical REST API (1k QPS, 5 logs per request), that's ~5% of one dedicated CPU core. Usually not detectable outside intentional profiling. If you're CPU-bound, `redactKeys: []` cuts the dominant bottleneck.

## Why is Rust so reduced in features?

The Rust v0.1 is intentional — a zero-dep JSON builder that's trivially auditable (~100 lines of `lib.rs`). Adding formatters, recursive redaction, and batched transport without pulling in crates is real, well-tested work, and it landed for v0.2.

## Can I contribute?

Yes. See [CONTRIBUTING.md](../../CONTRIBUTING.md). The single most important principle: **parity across runtimes**. If you add a feature to one runtime, think about what it becomes in the other three.

## Who maintains this?

Jonathas Cordeiro (<https://github.com/jonathascordeiro20>). Solo at the moment. Open to maintainers — especially someone fluent in Go or Rust who wants to own that runtime's roadmap.

## Can I use it commercially?

MIT. Yes — no royalty, no notice, no obligation to contribute. Forking without prior communication (issue, email) isn't recommended, but it's fully your right.

## Where do I report a security vulnerability?

DO NOT use public issues for vulnerabilities. Email directly: <jonathas.cordeiro2023@gmail.com> with subject `[security] openinfra-logger`. Response within 48 business hours.

## What if I only want the JSON shape without the lib?

Use it. The contract is in [02 · Concepts](02-concepts.md#the-json-contract). It's not proprietary; document your interpretation in your repo and you're done. The lib is a reference implementation, not the only one.

## Will there be a v1.0?

When: the APIs stabilize enough that we can commit with strict semver. When: Rust and Go reach parity with Node and Python (formatters, batching, redaction, OTel). Current estimate: **6–9 months**, depending on adoption and feedback.

## Next

→ [14 · API reference](14-api-reference.md) — exact signatures per runtime.
