# Ecosystem inserts — checklist (post-launch, 4 weeks)

Submit one at a time, not all at once. Acceptance rates are higher when each PR / submission looks like a single thoughtful entry, not a marketing blast.

## Week 1 — Awesome lists (highest leverage)

PR a single entry to each list in the **Logging** section. Read the contributing guide first; some lists require alphabetical order, others "added by maintainers only".

| List | Section | URL | Notes |
|---|---|---|---|
| **awesome-nodejs** (sindresorhus) | Logging | https://github.com/sindresorhus/awesome-nodejs | High bar — entry needs ≥50 stars OR maintainer judgment. Submit after stars >50. |
| **awesome-python** (vinta) | Logging | https://github.com/vinta/awesome-python | Alphabetical. Single-line description, no marketing. |
| **awesome-go** (avelino) | Logging | https://github.com/avelino/awesome-go | Requires `go.sum` + `golint` clean + LICENSE + tests. |
| **awesome-rust** (rust-unofficial) | Logging | https://github.com/rust-unofficial/awesome-rust | Submission via dedicated PR template. |
| **awesome-observability** | Logging | https://github.com/adriennetacke/awesome-observability | Smaller list, easier acceptance. |

### Suggested entry text (adapt per list)

```
- [openinfra-logger](https://github.com/jonathascordeiro20/openinfra-logger) — Universal structured logging with the same JSON shape across Node, Python, Go and Rust. Zero dependencies, native batching, auto-redaction, optional LLM deep-dive.
```

## Week 2 — Newsletters (one-shot, but each one is big)

These are curated email lists. A 1-line inclusion typically drives 200–2 000 visitors over the 48h after the issue ships.

| Newsletter | How to submit | Audience size |
|---|---|---|
| **JavaScript Weekly** | https://javascriptweekly.com — "Suggest a link" form | ~155k devs |
| **Node Weekly** | https://nodeweekly.com — same form | ~85k devs |
| **PyCoder's Weekly** | https://pycoders.com — "Submit a link" | ~120k devs |
| **Golang Weekly** | https://golangweekly.com — "Suggest a link" | ~50k devs |
| **This Week in Rust** | https://this-week-in-rust.org — PR to the GitHub repo | ~30k devs |
| **DevOps Weekly** | https://www.devopsweekly.com — submission form | ~70k SREs |
| **SRE Weekly** | https://sreweekly.com — open submission form | ~25k SREs |
| **Console** (open-source-focused) | https://console.dev/submit | ~30k devs |
| **Bytes** (JS) | https://bytes.dev/contact | ~250k devs |

### Pitch template (under 80 words)

```
Subject: OpenInfra Logger — structured logging for Node, Python, Go and Rust (zero deps)

Hi [first name],

I just released OpenInfra Logger, a small open-source library that emits
the same structured JSON across four runtimes — Node, Python, Go and Rust —
using only each language's standard library. It includes auto-redaction
of sensitive keys before transport, native batched HTTP, and a local-first
log analyzer (clusters + heuristics + cascade detection) with optional
LLM deep-dive.

MIT. v0.1.0 just published on all four package managers.

https://github.com/jonathascordeiro20/openinfra-logger

Thanks for considering it,
Jonathas
```

## Week 2 — Discord servers (find the #showcase channel)

Don't spam. Post once per server, only in the channel marked for projects.

| Server | Invite URL | Channel |
|---|---|---|
| **The Programmer's Hangout** | https://theprogrammershangout.com | #project-showcase |
| **Reactiflux** | https://reactiflux.com | #show-and-tell |
| **Python Discord** | https://pythondiscord.com | #show-your-projects |
| **Gophers** | https://gophers.slack.com (Slack, not Discord) | #showandtell |
| **Rust Programming Language** | https://discord.gg/rust-lang | #show-and-tell |
| **The Coding Den** | https://discord.gg/codingden | #project-showcase |

Posting template (one paragraph + one image + one link):

```
Hi all — I just shipped OpenInfra Logger 0.1.0, a structured logger that
emits the same JSON shape across Node, Python, Go and Rust with zero
dependencies in any of them. There's auto-redaction of sensitive keys,
native batching, Datadog/Elastic formatters, and a local-first log
analyzer with optional LLM deep-dive.

Repo: https://github.com/jonathascordeiro20/openinfra-logger
Site: https://openinfralogger.fun

Critical feedback welcome 🙏
```

## Week 3 — Stack Overflow seeding (long-tail traffic)

This is slow but compounds. Find 20 existing questions about polyglot structured logging and write **honest** comparative answers. Each answer should mention OIL as ONE option, not the answer. Stack Overflow's algorithm punishes link-spam aggressively.

Search queries that reliably surface candidate questions:

- `[logging] [python] [nodejs] structured JSON same format`
- `[logging] [golang] redact sensitive fields`
- `[opentelemetry] [logging] trace_id automatic injection`
- `[datadog] [logging] node python ecs`

For each one: a 200-word answer that compares ≥3 options (e.g., Pino + structlog + OIL), states the trade-off, and lets the reader pick.

## Week 4 — Conference CFPs

Submit to one or two CFPs that match the topic. The talk title that's worked in dry-runs:

> **Why we built the same logger four times — what cross-runtime observability actually requires**

| Conference | When | URL |
|---|---|---|
| **DevOpsDays Brazil** | varies, city by city | https://devopsdays.org/events |
| **GopherCon Brazil** | annual | https://gopherconbr.org |
| **PyCon Brazil** | annual | https://python.org.br/pycon-brasil |
| **The Rust Conf** | Sept | https://rustconf.com |
| **All Day DevOps** (virtual) | Oct | https://www.alldaydevops.com/call-for-papers |
| **Open Source Summit Latin America** | Aug | https://events.linuxfoundation.org |

## Tracking

Keep a single spreadsheet with columns:

| Channel | Submitted on | Status | Link | Visitors driven |

After 4 weeks, the answer to "where do contributors / stars come from?" is in that sheet. Double down on the top 3 sources; deprioritize the rest.
