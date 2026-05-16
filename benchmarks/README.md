# Benchmarks

These scripts are intentionally simple. Their goal is to detect **regressions** between releases — not to win a logger shoot-out.

```bash
node benchmarks/node-baseline.js
```

## What's measured

| Metric | What it captures | What it does NOT capture |
|---|---|---|
| **Single-call latency** (p50 / p95 / p99) | The synchronous portion of `log(...)` — building the entry, redaction, formatter, dispatch to the console transport | Asynchronous I/O completion, file flush, remote batch flush |
| **Throughput** | Calls per second sustained for 2 s on a tight loop | Realistic application context, concurrent requests, log fanout |
| **Redaction overhead** | Cost of recursive `redactObject` over a 4-key sensitive payload | Cost over very deep / very wide payloads (sub-linear after that) |

The console transport is stubbed to a no-op during measurement to keep terminal repaint out of the numbers.

## Reading the output

Numbers move on every hardware. Sample from a recent local run (Node 24, Windows, AMD Ryzen-class):

```
Single-call latency: p50 ~ 99 µs · p95 ~ 156 µs · p99 ~ 226 µs
Throughput:          ~ 10 000 events / sec
Redaction overhead:  ~ 96 µs / call (4 redacted keys)
```

These are honest "off the shelf" numbers — no buffer warming beyond a 1 000-call warmup, no inline lambdas, default redaction list.

## Comparison with other loggers

We deliberately do **not** ship comparison numbers here. Different loggers default to different feature surfaces (context capture, OTel hooks, file rotation, redaction, batching), and a raw `per-second` race is misleading without normalizing each surface.

If you want a comparison on your hardware against [pino](https://github.com/pinojs/pino), [winston](https://github.com/winstonjs/winston) or [bunyan](https://github.com/trentm/node-bunyan), copy `node-baseline.js`, swap the logger import, and run both with the **same** transport and the **same** redaction list. Anything else is apples to oranges.

## Roadmap

- `python-baseline.py` — feature parity bench
- `go-baseline_test.go` — Go's built-in `testing.B` (`go test -bench=.`)
- `rust-baseline.rs` — `criterion` if we ever take a dev-dependency on it
- CI-gated regression threshold per metric
