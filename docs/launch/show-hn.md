# Show HN — draft

> **When to post:** Tuesday or Wednesday, **08h00–10h00 ET** (09h–11h BRT). Avoid Mondays (saturated) and Fridays (low traffic). Stay at your machine for the next 4 hours to reply to comments — the first hour determines whether the post survives or sinks.

> **Don't:** post on holidays (US calendar), don't title-shout, don't promise benchmarks you don't have, don't argue with critics — agree, ship a fix, link the commit. Devs respect that more than rhetoric.

---

## Title (≤80 chars)

```
Show HN: OpenInfra Logger – same JSON shape for Node, Python, Go, Rust (0 deps)
```

**Alternatives** (pick the one that feels least clickbaity to you on the morning of):

- `Show HN: A zero-dependency structured logger for 4 runtimes`
- `Show HN: One log shape across Node, Python, Go and Rust`

## Body (under the title input)

```
Hi HN — I'm Jonathas, the author.

I work on a polyglot stack — a Node API talking to a Python ML service and
Go workers — and I got tired of fixing log shape mismatches in Datadog
every quarter. Every team had picked a different logger; each emitted a
slightly different JSON; every dashboard had to special-case three
"timestamp" fields.

OpenInfra Logger (OIL) is my attempt to fix that: one structured JSON
shape, four implementations, each built from the language's standard
library only. No transitive deps in any of them.

What's in v0.1.0:

- Node, Python, Go and Rust, all emitting the same JSON
- Auto-redaction (password / token / secret / api_key / credit_card)
  before any transport sees the entry, recursive and case-insensitive
- Native batched HTTP transport for Node/Python (no Datadog agent needed)
- Datadog and Elastic (ECS) formatters via one config line
- OpenTelemetry trace_id / span_id picked up automatically (Node + Python)
- A local-first log analyzer CLI that runs seven layers of analysis
  on your machine — clustering, six heuristics, stack-trace dedup,
  temporal cascades, anomaly windows, service-interaction graph —
  with zero outbound calls. Opt in to --llm=ollama (local), =anthropic
  (cloud), or =openai (compatible endpoint) for an LLM narrative.
- 69 tests across the four runtimes

What it's NOT:

- a Pino/zap replacement on raw throughput — single-process Node
  hovers around 10k events/sec in the default config, not 200k. The
  selling point is "same shape everywhere", not microbenchmarks.
- production-ready for Rust yet — metadata values are String-only in
  0.1, 0.2 brings a Value enum.
- a hosted observability backend — OIL writes to your existing one.

Where:

  Site:    https://openinfralogger.fun
  Repo:    https://github.com/jonathascordeiro20/openinfra-logger
  npm:     @jonathascordeiro20/openinfra-logger
  PyPI:    openinfra-logger
  crates:  openinfra-logger
  Go:      github.com/jonathascordeiro20/openinfra-logger/go

Happy to answer anything about the design trade-offs, the redaction
implementation, or why the Rust JSON builder is hand-rolled. Especially
interested in feedback from anyone who's tried to standardize logs across
a polyglot team and what they wish someone had built.
```

## During the 4 hours after posting

- **Refresh comments every 5 min.** First-hour engagement is what HN's algorithm cares about.
- **Reply substantively, not defensively.** "Good point — fixed in [commit](url)" beats every other reply pattern on HN.
- **The critics teach more than the fans.** Take notes for v0.2.
- **Don't ask for upvotes**, anywhere. HN auto-flags that.

## Likely critical questions — pre-prepared answers

> "Why not just use Pino + a shared format?"

You can — and many teams should. OIL exists for teams where Pino doesn't help: the Python service, the Go workers, the Rust agent on edge. The contribution isn't a faster logger, it's a single JSON contract across four runtimes.

> "Zero dependencies sounds religious. Why?"

Two reasons. (1) Supply chain — most observability libraries pull in 20-50 transitive deps; one bad release breaks production. (2) Honesty — if a structured logger needs a build toolchain, it's the wrong tool. The Rust JSON builder is ~100 lines and RFC 8259-compliant; tests cover it.

> "Your throughput numbers are modest."

They are. The default config measures around 10k events/sec on Node 24, with auto-redaction enabled. Disable redaction and the number ~doubles. Most apps log far below that ceiling. If you're at 50k+ events/sec/process and budget-sensitive, Pino is the right call.

> "License?"

MIT.

> "Who's behind this?"

Solo, for now. Open to maintainers — especially someone who lives in Rust or Go and wants to own that runtime's roadmap.
