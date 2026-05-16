# 05 · Transports

[← back to manual index](README.md)

A **transport** is the output channel for a log entry. OIL activates transports through the `transports` list. Multiple transports run in parallel; a failure in one does not affect the others.

## Console transport

### How it works

Each `log()` calls the appropriate stream of the runtime:

| Level | Node | Python | Go | Rust |
|---|---|---|---|---|
| `debug` | `console.debug` (stdout) | `_logger.debug` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `info` | `console.log` (stdout) | `_logger.info` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `warn` | `console.warn` (stderr) | `_logger.warning` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `error` | `console.error` (stderr) | `_logger.error` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |

> **Note (Python):** the internal Python logger uses `StreamHandler`, which writes to **stderr** by default. If you're redirecting stdout in tests, logs still appear on stderr. This is intentional — it separates logs from program output.

> **Note (Go / Rust):** v0.1 sends everything to stdout, ignoring the level. v0.2 will route `warn`/`error` to stderr in Go and Rust.

### When to use

- **Always**, in any environment. It's the cheapest transport and the most useful for Docker / Kubernetes which collect stdout/stderr automatically.
- In production behind an agent (Datadog Agent, fluent-bit, Vector), `console` is the **only** transport you typically need.

### When not to use

- In interactive CLIs where JSON pollutes user output — you wouldn't put `transports: ['console']` in a tool like `git status`. For CLIs, consider `transports: ['file']` pointing to `~/.cache/your-app/log.jsonl`.

## File transport

### How it works

Each `log()` appends to the file at `filePath`. The open mode is "append + create":

```
node:   fs.appendFile(path, line + '\n', cb)  ← async, serialized by chain
python: open(path, 'a').write(line + '\n')    ← sync, no race
go:     os.OpenFile(path, O_APPEND|O_CREATE)  ← sync per call
rust:   OpenOptions::new().create().append()  ← sync per call
```

### Ordering under concurrent writes

This is the detail many people underestimate.

```
Naive implementation:
  log("A"); log("B"); log("C");

  Async runtime (Node):
    fs.appendFile starts 3 simultaneous syscalls
    → lines may appear as A, C, B
```

OIL on Node **chains writes via Promise**:

```js
let fileWriteChain = Promise.resolve();
function appendToFileOrdered(filePath, line) {
  fileWriteChain = fileWriteChain.then(() =>
    new Promise(resolve => fs.appendFile(filePath, line, () => resolve()))
  );
  return fileWriteChain;
}
```

This guarantees lines appear **in the order `log()` was called**. Cost: a small extra hot-path latency under contention (~5–15 µs/call at 1k QPS).

In Python / Go / Rust the write is sync, so order is natural.

### Permissions and rotation

- The file is created with the umask's default permissions (usually `0644`).
- **OIL does not rotate.** Use `logrotate`, `multilog`, or a shipper (fluent-bit) that rotates upstream.
- If the file is deleted externally while OIL has it open (Linux): **writes continue into an orphan inode**. You will not see new logs in the new file. This is the classic `logrotate` trap — use `copytruncate` or send a signal to recreate the handle.

### When to use

- **Compliance / audit** that requires logs on disk on the same host.
- **Fallback** when the remote transport fails — write to file, let a shipper send later.
- **Local debug** when you want `tail -f` in the shell.

### When not to use

- **In stateless containers** without a mounted volume — you lose logs on `kubectl delete pod`.
- **On read-only filesystems** (which is what you want in hardened production) — the write fails silently, with a message on stderr.

## Remote transport

### How it works

```
                      ┌───────────────┐
log() ──────────────▶ │ in-memory     │
                      │ buffer (FIFO) │
                      └─┬─────┬───────┘
                        │     │
       batchSize=100 ───┘     └─── timer flushIntervalMs=2000
       reached                     fires
                        │     │
                        ▼     ▼
                  ┌────────────────┐
                  │ POST as a JSON │
                  │ array body     │
                  └────────────────┘
```

The first `log()` call fills the buffer. Two triggers fire a POST:

1. **By size:** when `buffer.length === batchSize` (default 100), flush is immediate.
2. **By time:** when the first item enters the buffer, a timer (`flushIntervalMs`, default 2000 ms) is scheduled; when it fires, it flushes whatever is there.

The timer is cancelled and re-scheduled on each size-triggered flush, so the window is "at most 2 s since the **first** item in the current batch".

### What goes over the wire

```json
[
  { "timestamp": "...", "level": "info", "message": "evt1", ... },
  { "timestamp": "...", "level": "info", "message": "evt2", ... },
  ...
]
```

A JSON array, not NDJSON. Reason: Datadog API, Elastic Bulk, and Loki Push accept array payloads; NDJSON requires a specific Content-Type or wrappers. If you need NDJSON, serve through a local shipper (`vector`/`fluent-bit`) reading from the `console` transport.

### Failures

If the POST fails (timeout, 5xx, refused connection):

- **Node:** the `.catch()` on the `fetch` writes an error message to `console.error` and discards the batch. The buffer is **not** re-enqueued.
- **Python:** `try/except` around `urlopen`, same strategy.
- **Go:** `client.Do(req)` in a goroutine; errors are silent (fire-and-forget).

This is intentional: **we never block the application process because of a logging failure**. If you need delivery guarantees, place a local shipper in the path (Vector → on-disk buffer → backend) and use OIL with `console` to feed the shipper.

### When to use

- When you have no local agent and want to push JSON straight to `logs.example.com/ingest`.
- In serverless architectures where stdout collection is not reliable.

### When not to use

- In critical production without edge retry. Use `console` + an agent.
- Under very high log cardinality (>10k QPS) — the sync batch grows large. Lower `batchSize` to 25 and `flushIntervalMs` to 500.

## Multiple transports at once

```js
configure({ transports: ['console', 'file', 'remote'], ... });
log('hello', 'info');
```

Behavior:

1. The JSON is built once.
2. **Redaction** is applied **once** to the entry (not per transport).
3. Each transport receives the **same redacted string**.
4. A failure in one does not affect the others.

Internal dispatch order: console → file → remote. There's no guarantee that the entry appears on the console **before** the file write completes — the three run in parallel (to the extent allowed by the single-threaded event loop in Node/Python).

## Next

→ [06 · Formatters](06-formatters.md) — `default`, `datadog`, `elastic` field-by-field.
