# 09 · Log analyzer

[← back to manual index](README.md)

The `npm run analyze <log-file>` CLI is a log analyzer that runs **fully on-host** by default. No network call, no external dependency, no upload.

The analysis has 7 layers. An optional 8th layer adds an LLM (Anthropic / Ollama / OpenAI-compatible) for narrative prose.

## Invocation

```bash
npm run analyze ./logs/app.log                        # 100% local
npm run analyze ./logs/app.log -- --prompt-only       # print prompt, no API call
npm run analyze ./logs/app.log -- --llm=ollama        # local LLM
npm run analyze ./logs/app.log -- --llm=anthropic     # cloud (needs key)
npm run analyze ./logs/app.log -- --llm=openai        # OpenAI-compatible
npm run analyze ./logs/app.log -- --help              # show all flags
```

## The 7 local layers

### 1. Parse

Reads the file and attempts `JSON.parse` on each line. Keeps valid entries; counts non-JSON lines separately.

Supports the 3 OIL shapes: `default` (`level`+`timestamp`), `datadog` (`status`+`timestamp`), `elastic` (`log.level`+`@timestamp`). Helpers `levelOf`/`tsOf`/`traceOf` accept any of them.

### 2. Cluster by normalized message

UUIDs, hex (0x…), and long digit runs (`\d{2,}`) are replaced with generic placeholders before grouping. Result: variations like `request abc-123 failed` and `request def-456 failed` collapse into the same cluster.

Output: top-N clusters ranked by frequency, with level, services involved, first/last occurrence.

### 3. Regex heuristics

Six predefined patterns:

| Name | Pattern | Printed hint |
|---|---|---|
| Timeout cascade | `timeout\|deadline exceeded\|ETIMEDOUT\|ECONNRESET\|context deadline` | "Check upstream latency, retry budgets, pool sizes" |
| Out of memory | `out of memory\|OOM\|heap out\|killed\|cannot allocate` | "Container limits, payload size, leak suspects" |
| Database failure | `deadlock\|connection refused\|too many connections\|constraint\|duplicate key\|relation .* does not exist` | "DB pool, recent migrations, index on join key" |
| Auth / 401-403 | `unauthorized\|forbidden\|invalid token\|jwt\|expired\|401\|403` | "Token rotation, clock skew, audience claim" |
| 5xx upstream | `5\d\d\|bad gateway\|service unavailable\|internal server error` | "Aggregate by upstream host" |
| Rate limit | `429\|rate.?limit\|too many requests\|throttle` | "One caller likely misconfigured" |

Matches against the normalized cluster key, so `db.timeout: deadline exceeded on findOrder()` matches `timeout cascade`.

### 4. Stack-trace dedup

For entries with a `stack`/`stack_trace`/`error.stack` field, extracts the first 3 frames, normalizes line numbers (`:42:10` → `:L`) and absolute paths (`/full/path/node_modules/x` → `node_modules/x`), and groups.

Useful for discovering "the same bug fired 500 times today".

### 5. Temporal cascade detection

Sliding 1-second window over timestamps. Whenever ≥3 error entries fall within the same second, it's recorded as a cascade with start, end, event count, and involved services.

That's the classic "something broke and propagated" signal.

### 6. Per-minute anomaly via z-score

Buckets entries by minute. Computes mean and standard deviation. Prints minutes with z ≥ 2 (events-per-minute well above the baseline).

Useful for spotting short spikes in long logs without an external monitor.

### 7. Service interaction graph

For entries with `trace_id`, groups by trace and extracts pairs of services that co-occur in the same trace. Counts the occurrences.

Output: the top 5 most frequent pairs (e.g. `checkout-api ↔ auth-svc · 38 traces`). This reveals real traffic topology without a dedicated tracer.

## The 8th layer — LLM opt-in (3 providers)

When you pass `--llm=<provider>`, the analyzer builds a prompt with the summary of the 7 layers and sends it to the chosen provider:

### `--llm=anthropic` (cloud)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run analyze app.log -- --llm=anthropic
```

Optional env vars:

- `ANTHROPIC_MODEL` (default: `claude-haiku-4-5`)

Endpoint: `https://api.anthropic.com/v1/messages`. The default model is haiku (fast, cheap). For deep analysis on large incidents, prefer `sonnet`.

### `--llm=ollama` (local)

```bash
# 1. Install Ollama once: https://ollama.com
# 2. Pull a model:
ollama pull llama3.1
# 3. Run:
npm run analyze app.log -- --llm=ollama
```

Optional env vars:

- `OLLAMA_HOST` (default: `http://localhost:11434`)
- `OLLAMA_MODEL` (default: `llama3.1`)

Endpoint: `<OLLAMA_HOST>/api/chat`. Runs 100% locally — no data leaves your machine. Typical latency on a laptop with GPU: 5–15 s for a full response.

### `--llm=openai` (compatible endpoint)

```bash
# OpenAI directly:
export OPENAI_API_KEY=sk-...
npm run analyze app.log -- --llm=openai

# Or local LM Studio:
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=qwen2.5-coder-32b
npm run analyze app.log -- --llm=openai
# (no API key — LM Studio accepts anonymous)

# Or vLLM, Together, Groq, Perplexity, etc. — any compatible endpoint.
```

Env vars:

- `OPENAI_API_KEY` (required if base is `api.openai.com`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

### `--prompt-only`

Prints the formatted prompt for you to paste into the chat of your choice (claude.ai, ChatGPT, etc.) without making any call. Useful when you don't want to give an API key to the analyzer.

## Anatomy of a run

```
$ npm run analyze ./logs/error.jsonl

📊 OpenInfra Logger — log analyzer
==================================

📄 ./logs/error.jsonl — 1,847 structured entries, 0 non-JSON lines
🔍 12 anomaly entries (level=error|warn)

📦 Top error clusters
─────────────────────
     8× [error] checkout-api  ·  db.timeout: deadline exceeded on findOrder()
     2× [error] auth-svc      ·  ECONNRESET to upstream auth-svc
     1× [warn]  worker        ·  slow query: 2400ms in orderRepo.list()
     1× [error] worker        ·  out of memory: container killed

🩺 Heuristic findings
─────────────────────
  8× Timeout cascade
    └─ Check upstream latency, retry budgets, and connection pool sizes...
  1× Out of memory
    └─ Check container memory limits, recent payload-size changes...
  1× Database failure
    └─ Inspect the DB pool, recent migrations, index on join key...

🧱 Top stack traces (top-3 frames, deduped)
─────────────────────────────────────────────
     8× Error: timeout ↳ at findOrder (/app/repo.js:L) ↳ at handler (/app/route.js:L)

⚡ Temporal cascades (≥3 errors / 1 s)
────────────────────────────────────────
  3× between 2026-05-15T10:00:05.100Z → 2026-05-15T10:00:05.500Z  ·  services: checkout-api

📈 Per-minute anomaly windows (z ≥ 2 over baseline 1.2 ± 0.4)
─────────────────────────────────────────────────────────────
  2026-05-15T10:00:00Z  ·  6 errors  ·  z=12.00

🕸  Service interactions (derived from trace_id)
────────────────────────────────────────────────
     1 traces  ·  auth-svc ↔ checkout-api

🏷  Errors by service
────────────────────
     7× checkout-api
     1× auth-svc
     1× worker

⏱  Window: 2026-05-15T10:00:05.100Z → 2026-05-15T10:02:30.000Z

💡 Local analysis complete. For an LLM-deepened narrative, opt in:
   npm run analyze app.log -- --llm=anthropic   (cloud, ANTHROPIC_API_KEY)
   npm run analyze app.log -- --llm=ollama      (local Ollama)
   npm run analyze app.log -- --llm=openai      (OpenAI-compatible endpoint)
   npm run analyze app.log -- --prompt-only     (print prompt, no API call)
```

## How the prompt is assembled (for the curious)

```text
You are an expert Site Reliability Engineer (SRE). Analyze the following
clustered error logs from a production system.

Identify the most probable root cause, the suspected upstream and downstream
impact, and propose 3 concrete remediation steps the on-call engineer can
take in the next 30 minutes.

Total errors: 12
Heuristic findings: Timeout cascade (8×), Out of memory (1×), Database failure (1×)
Temporal cascades: 1
Anomaly windows: 1
Service interactions (top 3): auth-svc ↔ checkout-api (1)

Top clusters:
[ { count: 8, levels: ['error'], services: ['checkout-api'], pattern: 'db.timeout: deadline exceeded on findOrder()', sample: { ... } }, ... ]
```

The LLM responds with markdown prose. The output is written to stdout — you can redirect to a file (`> diagnosis.md`).

## Known limitations

- Parsing **skips non-JSON lines without a detailed warning**. If your log is mixed JSON + plain text, consider `grep '^{' app.log | npm run analyze /dev/stdin -- ...` (which is not yet wired — workaround: save to a clean file first).
- The anomaly z-score window is **per fixed minute**. Bursts shorter than 60 s don't appear there (they show up in "Temporal cascades" instead).
- The LLM mode does not send **redacted values** (`[REDACTED]`), but it does send the cluster pattern (e.g. `password mismatch for user N`). The text of the message itself goes to the LLM. If your application logs free text with PII, redact at the application layer first.

## Next

→ [10 · Performance](10-performance.md) — honest numbers, tuning, hot-path notes.
