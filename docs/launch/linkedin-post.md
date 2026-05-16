# LinkedIn — draft

> **Audience:** mix técnico (devs, SREs, CTOs de PMEs) + decisores BR (compliance LGPD).
> **When:** Same morning as Show HN, 09h BRT. Standalone post, not a re-share.
> **Length:** 250–400 words. LinkedIn penalizes posts longer than 1300 chars in the algorithm; keep it tight.
> **Image:** the github-social-1280x640 PNG already generated.
> **No external link in the first 1000 chars** — LinkedIn down-ranks posts that lead with a link. Put the URL at the end after a few "see comments" patterns.

---

## Versão A — técnico, em português

```
6 meses atrás, em um incidente de produção às 23h do domingo, descobri
que três times da empresa tinham escolhido três loggers diferentes em
três linguagens diferentes. Cada um emitia um JSON com nome de campo
diferente para "timestamp", "level" e "trace_id".

O Datadog não conseguia correlacionar. O on-call (eu) ficou duas horas
fazendo grep manual em três streams contra três schemas. O bug? Estava
no terceiro serviço, em Go, com um logger que ninguém tinha mapeado
para o nosso parser de Datadog.

Eu fui pra casa, abri 4 abas no editor, e escrevi a primeira versão
do que virou o OpenInfra Logger.

A ideia é boring por design:
✦ Um JSON shape, quatro implementações: Node, Python, Go, Rust
✦ Zero dependências externas em qualquer uma das quatro (stdlib only)
✦ Auto-redação de senha/token/cartão antes do log sair do processo
✦ Batched HTTP transport (100 eventos ou 2s — não 1 log = 1 request)
✦ Datadog e Elastic (ECS) como formatadores nativos
✦ Triagem local de erros com sete camadas de análise — clusters,
  heurísticas, cascatas temporais, anomalias por z-score, grafo de
  serviços derivado do trace_id. Zero chamada de rede por default.
✦ Opt-in opcional pra Ollama local, Anthropic, ou qualquer endpoint
  OpenAI-compatible para um diagnóstico em prosa.

69 testes verdes nas 4 linguagens. MIT. v0.1.0 publicada hoje no
npm, PyPI, crates.io e como Go module.

Se vocês trabalham com stack poliglota e brigam com Datadog/Elastic
toda vez que um serviço novo entra, dá uma olhada. Feedback honesto
é o que mais vou agradecer essa semana.

Site (link no primeiro comentário pra não machucar o algoritmo).
```

**Primeiro comentário (você responde a si mesmo logo após postar):**

```
https://openinfralogger.fun · https://github.com/jonathascordeiro20/openinfra-logger
```

---

## Versão B — em inglês (use se sua rede LinkedIn for majoritariamente em inglês)

```
Six months ago, during a Sunday-evening production outage, I learned
that three teams in our company had picked three different loggers
across three languages. Each emitted a slightly different JSON. Datadog's
correlation broke at the language boundary. The on-call (me) spent two
hours grepping three log streams against three schemas.

I went home, opened four editor tabs, and wrote what became
OpenInfra Logger.

The pitch is intentionally boring:

→ One JSON shape, four implementations (Node, Python, Go, Rust)
→ Zero external dependencies in any of them — stdlib only
→ Auto-redaction of password/token/card before any transport sees it
→ Batched HTTP transport (100 events or 2s, whichever first)
→ Native Datadog and Elastic (ECS) formatters
→ Local-first log triage with seven analytical layers — clusters,
  heuristics, temporal cascade detection, z-score anomalies, service
  graph from trace_id. Zero network calls by default.
→ Optional LLM deep-dive: Anthropic (cloud), Ollama (local), or any
  OpenAI-compatible endpoint. You choose where your logs go.

69 tests across all four runtimes. MIT. v0.1.0 published today on
npm, PyPI, crates.io and Go modules.

If you've been fighting Datadog every time a polyglot service ships,
take a look. Honest feedback is what I'd appreciate most this week.

Link in the first comment (so the algorithm doesn't bury this post).
```

**First comment:** `https://openinfralogger.fun`

---

## What NOT to do on LinkedIn

- Don't open with "Excited to announce" / "Thrilled to share" — those phrases mark the post as PR copy and humans skip it.
- Don't use the rocket emoji (🚀). Use ✦ or → if you need bullets.
- Don't tag anyone unless they have actually contributed.
- Don't ask for likes. Don't ask for shares. Don't ask for "any feedback would be appreciated 🙏".
- Don't cross-post the Twitter thread as-is. LinkedIn's voice is more formal — keep the substance, drop the casual cadence.

## After posting

- Reply to every comment within the first 2 hours (algorithm boost).
- DON'T reply with "Thanks!" — say something specific that the commenter said, even one sentence.
- If a recruiter / VC reaches out unrelated, ignore. The post is about the project, not lead-gen.
