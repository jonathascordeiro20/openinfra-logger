# 12 · Troubleshooting

[← back to manual index](README.md)

Symptom → likely cause → fix. If nothing here helps, open an issue with the output of `log('test', 'info', { check: true })` and your configuration.

## Logs not appearing

| Symptom | Likely cause | Fix |
|---|---|---|
| Nothing on stdout/stderr | `transports: []` | Set `transports: ['console']` or at least one active transport |
| Nothing in the file | `filePath` points at a directory without write permission | `chmod +w` the directory, or point at `/tmp/...` to test |
| Nothing in the file but the process has permission | Read-only filesystem (hardened containers) | Use a mounted RW volume, or replace `file` with `remote` |
| Logs on stderr (Python) unexpectedly | Intentional — Python logs to stderr | OK. If problematic, capture with `2>&1` |

## Lines out of order (Node, file transport)

| Symptom | Cause | Fix |
|---|---|---|
| Lines appear in the file as A, C, B | Bug in pre-0.1.0 — fixed. Confirm the version | `npm ls @jonathascordeiro20/openinfra-logger` should show ≥ 0.1.0 |
| Lines still out of order on 0.1.0+ | Another process writes to the same file | Each process needs its own `filePath` |

## Invalid level

| Symptom | Cause | Fix |
|---|---|---|
| `log('msg', 'verbose')` emits with `"level":"info"` and a warning | Intentional since v0.1.0 | Use only `debug` / `info` / `warn` / `error` |
| I want to suppress the fallback warning | Not exposed in v0.1.0 | Open an issue, or lint the level before the call |

## Redaction not working

| Symptom | Likely cause | Fix |
|---|---|---|
| `password: 'secret'` still appears in plain text | `redactKeys: []` was passed in some `configure()` | Check the effective list — `configure({ redactKeys: ['password', ...] })` replaces it |
| `passwd` is not redacted | Not in the defaults | Add `'passwd'` to `redactKeys` |
| `authorization` in headers is not redacted | Not in the defaults | Add `'authorization'` and `'cookie'` to the list |
| Sensitive value in `message` appears | `message` is **not** redacted (free text) | Move the value to metadata: `log('login', 'info', { password: pw })` |
| Stack trace contains a value | Stack is a free string | Clean it first: `log('failed', 'error', { error_type: e.name, error_msg: e.message })` (without `e.stack`) |

## Remote transport not sending

| Symptom | Likely cause | Fix |
|---|---|---|
| `console.error: Failed to send remote logs batch` | Endpoint returning ≥400 | Check `remoteUrl`, headers, CORS |
| Batch takes 2 s to send | Default `flushIntervalMs: 2000` | Lower to 500 if you want a more aggressive flush |
| On Lambda/serverless, last batch lost at exit | Process dies before the timer fires | Workaround: `await new Promise(r => setTimeout(r, 600))` before exit. Issue open to expose a synchronous `flush()` in v0.2 |
| In production at 10k+ events/sec, latency high | Internal buffer grows without backpressure | Lower `batchSize` to 25 and use a local shipper (Vector → backend) |

## Go tag not resolving

| Symptom | Cause | Fix |
|---|---|---|
| `go get .../openinfra-logger/go@v0.1.0` returns "no matching versions" | Subpath tag missing | v0.1.0 already has `go/v0.1.0`. Force with `GOPROXY=https://proxy.golang.org go get .../v0.1.0` |
| `go: module github.com/.../go: invalid version v0.1.0` | You used `@v0.1.0` against the proxy directly | Use the normal form `@v0.1.0` — Go resolves the prefix automatically given the correct module path |

## docs.rs has no documentation

| Symptom | Cause | Fix |
|---|---|---|
| `docs.rs/openinfra-logger` returns "no docs" | Build still queued | Wait 5–15 min after publish |
| Doc build failed | Source error docs.rs flags | Check `https://docs.rs/crate/openinfra-logger/latest/builds` |

## PyPI shows wrong metadata

| Symptom | Cause | Fix |
|---|---|---|
| Long description doesn't render | `pyproject.toml` missing `readme = "README.md"` | v0.1.0 already has it; if you forked, verify |
| Wrong classifiers (e.g. "Beta" when you wanted "Production") | Hardcoded in `pyproject.toml` | Change and re-publish as v0.2 |
| Long description truncated | PyPI limit ~512 chars on `description` | Long text belongs in README, not `description` |

## Build / publish

| Symptom | Cause | Fix |
|---|---|---|
| `cargo publish: A verified email address is required` | Email not verified on crates.io | <https://crates.io/settings/profile> → add email → click the verification link |
| `cargo publish: no token found` | Missing `cargo login` | `cargo login <TOKEN>` or `$env:CARGO_REGISTRY_TOKEN="..."` |
| GitHub workflow `publish-pypi.yml` fails with "OIDC claim mismatch" | Pending publisher on PyPI with the wrong `Repository` | Check <https://pypi.org/manage/account/publishing/> — should be `jonathascordeiro20/openinfra-logger`, not the owner duplicated |
| Workflow fails on environment | `environment: pypi` in the YAML but it doesn't exist in the repo | Create it in Settings → Environments → New environment → "pypi" |

## OpenTelemetry doesn't show up

| Symptom | Cause | Fix |
|---|---|---|
| `trace_id` missing even with OTel active | Span outside the context of the `log()` call | Ensure `log()` is inside the `startActiveSpan` callback / context manager |
| In Python: `ImportError: opentelemetry` while logging | OIL **does not** fail — `try/except ImportError` silences it | No action. If you want detection, install `pip install opentelemetry-api` |
| In Node, `trace_id` appears in a sync handler but not in `setTimeout` | OTel context lost in async callback | Use `context.with(...)` or `AsyncLocalStorage` on Node 16+ |

## How to report a bug

1. Exact version: `npm ls @jonathascordeiro20/openinfra-logger`, `pip show openinfra-logger`, etc.
2. Runtime: `node --version`, `python --version`, `go version`, `rustc --version`
3. System: `uname -a` (Linux/macOS) or `ver` (Windows)
4. **Minimal** snippet that reproduces it
5. Expected output vs observed output
6. Issue: <https://github.com/jonathascordeiro20/openinfra-logger/issues/new/choose>

## Next

→ [13 · FAQ](13-faq.md) — questions that always come back.
