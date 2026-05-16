# Dev.to article — draft

> **When:** Same day as Show HN. Cross-post to Hashnode and Medium next day with canonical URL pointing to Dev.to.

> **Length:** 1500–2200 words. Below that = too thin. Above = nobody reads to the CTA.

> **Cover image:** the github-social-1280x640 PNG you've already generated.

---

Title:

```
Why I built the same logger four times (so you don't have to)
```

Subtitle / preamble:

```
A 1500-word walkthrough of how OpenInfra Logger emits the same JSON
shape across Node, Python, Go and Rust — using only the standard
library, no transitive dependencies, with auto-redaction and native
batching built in.
```

Tags: `#opensource`, `#javascript`, `#python`, `#go`, `#rust`, `#observability`, `#logging`

---

## The bug that started it

Six months ago I was debugging a Sunday-evening payment outage in production. The error wasn't in the Node API. It wasn't in the Python ML service. It was in the small Go worker that batched both teams' events into Kafka — and the Go team had picked a different logger six months earlier, with a different timestamp format, a different level key, a different field for `trace_id`.

Datadog's correlation broke at the language boundary. The on-call (me) spent two hours grepping three log streams against three JSON shapes because nobody had agreed on the format.

I went home that night and did the dumb thing: opened four editor tabs and started writing a logger that emitted the same JSON in all four runtimes my team used. It became OpenInfra Logger.

This is the post I wish I had read before starting.

## The problem space, precisely

Most "logger" libraries are excellent at being their language's logger. Pino is a great Node logger. structlog is a great Python logger. zap is a great Go logger. tracing is a great Rust logger.

What none of them are is **four languages' loggers at once**. And the polyglot teams I've worked on don't have a budget to ship four separate "log format adapters" — they have a budget to ship features.

So in practice, the problem isn't "write the fastest logger". It's "write the boring one that emits the same shape everywhere, with the minimum surface that lets you ingest into Datadog or Elastic without writing a parser per service."

## Constraint #1 — zero external dependencies

I picked this constraint on day one and it forced every other design decision.

Why? Two reasons:

**Supply chain.** A logger that pulls in 20-50 transitive packages is a logger that ships a vulnerability advisory every few months. If a structured logger needs `lodash` and `chalk` and `dayjs`, something has gone wrong with the field's expectations.

**Honesty.** If "structured logging" is just "write JSON to stdout", then the implementation should look like "write JSON to stdout". Hiding that behind a tower of abstraction costs you debugging clarity at the worst possible moment — 3 AM, the incident is live, and `node_modules` is 80MB.

The cost of the constraint:

- The Rust implementation hand-rolls JSON escaping. It's ~100 lines and RFC 8259-compliant. There are tests. Hand-rolled doesn't mean wrong.
- The Python implementation uses `urllib.request` for the remote transport instead of `requests`. Two more lines of code; one fewer Snyk advisory.
- The Node implementation skips `pino-pretty`-style colorized output. If you want it, pipe to `jq -C` and call it done.

I'd take that trade every time.

## Constraint #2 — one JSON shape across four runtimes

The actual product is the contract, not the code. The contract:

```json
{
  "timestamp":   "2026-05-15T13:42:01.041Z",
  "level":       "info",
  "message":     "order.placed",
  "service":     "checkout-api",
  "env":         "production",
  "trace_id":    "a4f1c9...",
  "span_id":     "b3d8e2...",
  "user_id":     "u_8821"
}
```

This is what every transport sees, on every runtime, by default. The user passes a message, a level, and a metadata dict; the library merges default metadata, picks up the active OpenTelemetry span if present, and emits.

The Datadog formatter renames `level` → `status` and `trace_id` → `dd.trace_id`. The Elastic formatter renames `timestamp` → `@timestamp` and `level` → `log.level`. Both are one-liners in `configure()`.

This took longer to design than to implement. The mistake I almost made was offering a flexible "custom formatter" hook on day one. That's how libraries die — every team uses a different formatter and the "consistent shape" promise dies with it. Two formatters, ship.

## The interesting bug — the one that made it real

The Node implementation has this code:

```js
function log(message, level = 'info', metadata = {}) {
  const normalizedLevel = level.toLowerCase();

  if (!LEVELS[normalizedLevel]) {
    console.warn(/* fallback warning */);
    level = 'info';   // <-- this line
  }

  let logEntry = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,   // <-- but THIS reads normalizedLevel, not level
    // ...
  };
}
```

Spot the bug: when the user passes an invalid level (say, `"verbose"`), the fallback sets `level = 'info'` but the JSON entry reads `normalizedLevel`, which still holds `"verbose"`. So the warning fires, but the bad level still appears in the output.

I didn't catch this with manual testing. I caught it the day after I committed to writing the test matrix:

```js
test('invalid level falls back to info (regression: normalizedLevel bug)', async () => {
  log('bogus level', 'verbose');
  await wait(30);
  const e = readLastEntry(TMP);
  assert.strictEqual(e.level, 'info', 'Invalid level must be replaced with info in the emitted JSON');
});
```

That one test pulled the bug out. The fix was renaming the variable and updating the right one. The lesson is older than any of us: the test you write *before* you assume the code works is the only test that's allowed to fail in CI.

The Rust JSON builder had a similar story. Pre-test, my hand-rolled escaper looked correct. Post-test, the first message containing `"` produced invalid JSON. Now there's `escape_json_string()`, RFC 8259-compliant, with tests covering quotes, backslashes, newlines, tabs, control characters, and unicode.

69 tests total across the four runtimes. None of them are dishonest "the function returns successfully" tests. Every one asserts on actual observable output, parsed by a JSON parser, against an exact expected value.

## Auto-redaction — the one feature that's actually load-bearing

Every other feature in OIL has a reasonable alternative. Auto-redaction is the one I'd fight for.

LGPD and GDPR don't care that you forgot. The recursive redactor intercepts these key names — case-insensitive — at every level of the metadata payload, *before* any transport sees it:

```
password · token · secret · api_key · credit_card
```

So this:

```js
log('login attempt', 'info', {
  user: 'alice',
  password: 'p@ss',
  nested: { credit_card: '4111-1111-1111-1111' }
});
```

emits this:

```json
{ "user":"alice", "password":"[REDACTED]", "nested":{"credit_card":"[REDACTED]"} }
```

You can override the list. You can't accidentally disable it — the default is on, and disabling it requires explicit `redactKeys: []` in `configure()`.

This is the feature I've gotten the most "wait, that's free?" reactions to, and it's the one I'd recommend you check our implementation of even if you stay on your current logger.

## What's still rough

Let me be specific about what 0.1 is not:

- Raw throughput in Node is ~10,000 events/sec/process in the default config. Pino is 10–20× faster. If you're at 100k events/sec/process and budget-conscious, stay with Pino.
- The Rust implementation accepts `HashMap<String, String>` only — numbers and nested values land in 0.2 with a `Value` enum.
- The Go implementation doesn't yet have native batching or OTel injection (Node and Python do).
- There are no Sentry / New Relic / Honeycomb shorthand formatters yet — they go via the "default" formatter.

I'd rather ship 0.1 honest than 1.0 with hidden gaps.

## Try it

Install:

```
npm install @jonathascordeiro20/openinfra-logger
pip install openinfra-logger
cargo add openinfra-logger
go get github.com/jonathascordeiro20/openinfra-logger/go@v0.1.0
```

Site: <https://openinfralogger.fun>
Repo: <https://github.com/jonathascordeiro20/openinfra-logger>

If you've solved this problem differently in your team — especially if you converged on a shared format without writing a library — I'd love to hear how. The Issues page is the best venue; my goal for v0.2 is mostly "what other teams are doing for cross-runtime log shape" before I add another feature.

Thanks for reading.

---

## Hashtags pinned in the footer

`#javascript #python #golang #rust #opensource #observability`

## After publishing

- Cross-post to Hashnode with `<canonical>` pointing to the Dev.to URL.
- Cross-post to Medium with `<canonical>` pointing to the Dev.to URL.
- LinkedIn share: short summary + link, **not** a full re-post (LinkedIn algorithm penalizes external links if they're the only thing in the post; pair with 3 sentences of original commentary).
