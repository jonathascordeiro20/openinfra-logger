# Twitter / X thread — draft

> **When:** Same day as Show HN, but **after** the HN post has had at least 30 minutes of traction (so you can link to your own HN submission in the last tweet).

> **Voice:** First-person, no marketing speak, no "🚀". Devs scroll past hype.

> **Format:** 1 hook → 4–5 substance tweets → 1 call to action. Don't go past 8 tweets.

> **Images:** Carbon.now.sh screenshots for code snippets. One image per substantive tweet. No memes.

---

## Tweet 1 — hook

> I work on a polyglot stack (Node + Python + Go) and every quarter we discover three teams emit three "timestamp" fields. Three Datadog parsers. Three dashboard branches.
>
> I built a logger that solves this for one specific reason: same JSON shape, four runtimes, zero dependencies.

## Tweet 2 — the actual problem

> Every logger is good at being its language's logger.
> Nobody is good at being four languages' loggers at once.
>
> So polyglot teams get this:
>
>   Node:   "level":"info",  "ts":1747391521000
>   Python: "level":"INFO",  "timestamp":"2026-05-15T..."
>   Go:     "lvl":"info",    "time":"2026-05-15T..."
>
> Same event. Three shapes.

## Tweet 3 — the fix

> [Carbon screenshot — four code blocks, one per runtime, same call, same JSON output]
>
> Same call: `log("order.placed", "info", { user_id, card })`.
> Same JSON out.
> Across Node, Python, Go, Rust.

## Tweet 4 — the constraint that made it work

> The constraint that forced clean design: zero dependencies in any of the four implementations. Stdlib only.
>
> Hand-rolled JSON in Rust. Native `http.client` in Python. `net/http` in Go. No supply chain to babysit.
>
> The Rust escaper is ~100 lines and RFC 8259-compliant.

## Tweet 5 — the actually useful features

> Built in, no extra packages:
>
> ✦ Auto-redact password / token / secret / api_key / credit_card recursively
> ✦ Batched HTTP transport (100 events or 2s, whichever first)
> ✦ Datadog & Elastic (ECS) formatters via one config line
> ✦ OpenTelemetry trace_id / span_id picked up automatically

## Tweet 6 — bonus

> The repo ships a local-first log analyzer: clusters, heuristics, stack-trace dedup, temporal cascades, anomaly windows, service-interaction graph from trace_id. Seven layers. Zero network calls.
>
> [Carbon screenshot — terminal showing `npm run analyze` output]
>
> Want LLM narrative on top? `--llm=ollama` keeps it local. `--llm=anthropic` calls Claude. Your choice, opt in only.

## Tweet 7 — honest limitations

> What it's NOT:
>
> ✗ a Pino replacement on raw throughput (~10k events/sec/proc, default config)
> ✗ production-ready in Rust yet (metadata values are String-only in 0.1)
> ✗ a hosted backend (it writes to yours)
>
> If you're at 100k+ events/sec/proc, stay with Pino. If you're polyglot, give this a try.

## Tweet 8 — CTA

> Site:  openinfralogger.fun
> Repo:  github.com/jonathascordeiro20/openinfra-logger
> Show HN: [link to your HN post]
>
> 69 tests pass across 4 runtimes.
> MIT. Solo maintained. PRs welcome.

---

## Carbon.now.sh screenshot guide

| Tweet | Screenshot | Theme |
|---|---|---|
| 2 | The 3 mismatched JSON lines (Node/Python/Go) | `One Dark`, font `JetBrains Mono`, no line numbers, 1.2× scale, drop-shadow |
| 3 | A 2×2 grid: Node, Python, Go, Rust — same `log(...)` call | Same theme; export as a single PNG |
| 6 | Terminal mock of `npm run analyze` output | Use a real terminal screenshot instead of Carbon |

Crop everything to 16:9 to avoid Twitter's awkward auto-crop.

## Don't post

- "It's been an incredible journey" / "thread 🧵" / pinned-emoji garbage
- Anything mentioning DAU, MAU, ARR
- Promises about future features beyond what's in v0.1.0
