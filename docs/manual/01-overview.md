# 01 · Overview

[← back to manual index](README.md)

## Em uma frase

OpenInfra Logger emite **um JSON estruturado idêntico em Node.js, Python, Go e Rust**, sem nenhuma dependência externa em nenhuma das quatro implementações.

## Para quem foi feito

- **Times poliglotas** que rodam serviços em duas ou mais das quatro linguagens e perdem horas em incidentes alinhando schemas no Datadog ou Elastic.
- **SREs** que querem um shape canônico que entre direto em qualquer pipeline (file → fluent-bit → Loki, ou stdout → Datadog agent, etc) sem transformadores no caminho.
- **Aplicações regidas por LGPD / GDPR** que precisam garantir que `password`, `token`, `api_key`, `secret` e `credit_card` **nunca** saiam do processo sem redação.
- **Quem cansou de seu logger trazer 30 transitive deps** e prefere uma superfície menor para manter e auditar.

## Para quem **não** foi feito

- **Aplicações que precisam de 100k+ eventos/segundo/processo no Node** — o Pino continua sendo o caminho. OIL está em ~10k eventos/s/proc no default config, suficiente para ~99% das APIs, insuficiente para data pipelines síncronos.
- **Quem precisa de output bonito colorizado em dev** — saída é JSON, ponto. Faça pipe pra `jq -C` se quiser cor.
- **Quem precisa de redação por valor (e não por nome de campo)** — a v0.1 redacta por key name. Detecção semântica (regex em valores) está no roadmap.
- **Quem quer um backend** — OIL é cliente. Você precisa de Datadog, Elastic, Loki, CloudWatch ou outro lugar para receber.

## O que entrega na v0.1.0

| Capacidade | Node | Python | Go | Rust |
|---|---|---|---|---|
| JSON estruturado | ✓ | ✓ | ✓ | ✓ |
| Console transport | ✓ | ✓ | ✓ | ✓ |
| File transport | ✓ ordered | ✓ | ✓ | ✓ |
| Remote HTTP transport | ✓ batched | ✓ batched | ✓ fire-and-forget | — |
| Datadog formatter | ✓ | ✓ | ✓ | — |
| Elastic (ECS) formatter | ✓ | ✓ | ✓ | — |
| Auto-redaction | ✓ recursive | ✓ recursive | — | — |
| OpenTelemetry injection | ✓ auto | ✓ auto | — | — |
| Log analyzer CLI | ✓ via npm script (works on logs from any runtime) |

Os marcadores "—" são gaps documentados de v0.1.0 e estão no roadmap da v0.2.

## O contrato canônico do JSON

```json
{
  "timestamp":   "2026-05-16T03:42:01.041Z",
  "level":       "info",
  "message":     "order.placed",
  "service":     "checkout-api",
  "env":         "production",
  "trace_id":    "a4f1c9d3...",
  "span_id":     "b3d8e2f7...",
  "user_id":     "u_8821"
}
```

Toda implementação emite essa forma. Mais detalhes em [02 · Conceitos](02-concepts.md).

## O que torna esse projeto **diferente**

- **Mesmo JSON em quatro linguagens.** Não "compatível" — idêntico. Você pode parsear logs do worker em Go e do front-end Node com o mesmo schema.
- **Zero deps de package manager.** Nenhum `npm install` baixa outra coisa; nenhum `pip install` traz transitivos. Cada implementação usa apenas a stdlib da linguagem.
- **Redaction antes do transport.** Outras libs redactam na borda (no fluentd, no agente). OIL redacta dentro do processo, antes de qualquer escrita. Logs em disco já saem redatados.
- **Triagem local antes da IA.** O analyzer roda 7 camadas de análise (clusters, heurísticas, cascatas, anomalias) sem network. A IA é opt-in explícito, e três providers são suportados: Anthropic (cloud), Ollama (local), OpenAI (compatible).

## O que pode estar fora de escopo (para sempre)

- **Multi-tenant log routing**, **structured tracing primitives**, **metrics emission** — outros projetos (OpenTelemetry SDK, Prometheus client) fazem isso melhor. OIL faz logs.
- **Pretty printers / TUI** — JSON in, JSON out. Use `jq`, `pino-pretty`, `bunyan`, ou qualquer outro pretty-printer no consumo.
- **Persistent buffer / disk WAL** — se você precisa garantir que nenhum log se perde quando o processo morre, use um shipper dedicado (Vector, fluent-bit) entre o processo e o backend.

## Próximo passo

→ [02 · Conceitos](02-concepts.md) — entenda o contrato JSON, a arquitetura e por que a "zero deps" parou onde parou.
