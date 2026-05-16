# 10 · Performance

[← back to manual index](README.md)

> This chapter gives **honest** numbers and describes where the CPU cycles go inside `log()`. It is not a comparison against Pino / Winston / zap / structlog — for that, copy `benchmarks/node-baseline.js`, swap the library, and run both on the same hardware.

## Node baseline (Node 24, Windows, AMD Ryzen-class)

Running `node benchmarks/node-baseline.js` (with console stubbed to `/dev/null`):

| Metric | Value |
|---|---|
| Single-call latency p50 | ~ 99 µs |
| Single-call latency p95 | ~ 156 µs |
| Single-call latency p99 | ~ 226 µs |
| Throughput (tight loop, 2 s) | ~ 10,000 events/sec |
| Redaction overhead (4 keys, 1 nested) | ~ 96 µs/call |

These numbers are **environment-dependent**. Reproduce on your hardware before publishing claims.

## Where the cycles go (hot path)

```
log()
 ├─ 1. Date.now() / Date.toISOString()    ~ 2 µs
 ├─ 2. spread merge defaultMetadata        ~ 5 µs
 ├─ 3. try/catch + getActiveSpan (otel)    ~ 3 µs (without otel: ~0.5 µs)
 ├─ 4. spread merge metadata               ~ 5 µs
 ├─ 5. formatter rename (datadog/elastic)  ~ 1 µs (default: 0)
 ├─ 6. redactObject recursive              ~ 95 µs (4 keys + 1 nested)
 ├─ 7. JSON.stringify                      ~ 20 µs
 └─ 8. dispatch to transports              ~ varies
```

Redaction is the **dominant bottleneck** under a modest payload. If you have no sensitive fields and don't want to pay it:

```js
configure({ redactKeys: [] });
```

Without redaction, p50 drops to ~ 35 µs and throughput rises to ~ 22,000 events/sec.

## Tuning per profile

### "Typical REST API" (50–500 events/sec/proc)

Defaults are fine. Don't tune anything.

### "Worker with bursts" (5k–20k events/sec/proc for seconds)

```js
configure({
  // No redaction if the worker doesn't touch PII
  redactKeys: [],
  // Larger buffer if you use remote — fewer POSTs under load
  batchSize: 500,
  flushIntervalMs: 1000,
});
```

### "Edge / serverless" (short-lived, no persistence)

```js
configure({
  transports: ['console'],   // the edge agent collects this
  // No file (no disk), no remote (cold-start latency)
  redactKeys: ['password','token','secret','api_key','credit_card'],
});
```

### "Lambda / Cloud Run with no agent"

```js
configure({
  transports: ['console', 'remote'],
  remoteUrl: process.env.LOG_URL,
  // Functions are short — flush more aggressively
  batchSize: 25,
  flushIntervalMs: 500,
});

// And ALWAYS on graceful shutdown:
process.on('beforeExit', () => {
  // v0.1 doesn't expose flush() — issue open. Workaround:
  // sleep 600 ms to ensure the last batch left before exit
});
```

## Hot-path notes — Python

- `datetime.datetime.now(datetime.timezone.utc).isoformat()` is ~3× slower than `time.time()`. Under ultra-hot workloads (>50k events/sec/proc), consider opening an issue to propose an `epoch_millis` timestamp mode.
- The `threading.Timer` of the remote transport has creation cost. In production with `batch_size=1` (which triggers a timer on every log), the overhead is noticeable. Always use `batch_size >= 10`.

## Hot-path notes — Go

- Serialization is via `encoding/json`, which uses reflection. Under ultra-hot workloads, consider `easyjson` or `goccy/go-json` in your own fork.
- `dispatch` creates a goroutine per POST in the remote transport. Above 10k+ events/sec, this saturates the net pool. Implement a fixed worker pool in your wrapper (or wait for v0.2).

## Hot-path notes — Rust

- The `Config` struct uses `HashMap<String, String>` for metadata. String hashing is more expensive than needed. v0.2 will switch to `BTreeMap` or a wrapper with enum-discriminated keys.
- The hand-rolled JSON builder is, surprisingly, **faster** than `serde_json` for this specific case (no types, no schema), because it avoids the intermediate `serde_json::Value` allocation. Beneficiary: consistent latency; loser: extensibility.

## When OIL is **not** the right perf choice

- You need **> 50k events/sec/proc on Node** with high cardinality. Pino is the answer.
- You need **guaranteed flush in < 1 ms** after `log()`. Consider async logging with a persistent queue (Kafka client directly).
- You need **deterministic real-time behavior** (motorsports, trading). OIL allocates; it doesn't have a pre-allocated heap. You want a zero-alloc lib.

## How to reproduce the benchmark

```bash
cd C:/Users/jonat/openinfra-logger
node benchmarks/node-baseline.js
```

The code is in `benchmarks/node-baseline.js`. Modify it and PRs with new baselines (Python, Go, Rust) are welcome.

## Next

→ [11 · Migration guides](11-migration.md) — leaving Pino, Winston, structlog, zap.
