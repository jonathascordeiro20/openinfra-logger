# 09 · Log analyzer

[← back to manual index](README.md)

A CLI `npm run analyze <log-file>` é um analisador de logs que roda **fully on-host** por default. Sem chamada de rede, sem dependência externa, sem upload.

A análise tem 7 camadas. Uma 8ª camada opcional adiciona um LLM (Anthropic / Ollama / OpenAI-compatible) para narrativa em prosa.

## Invocação

```bash
npm run analyze ./logs/app.log                        # 100% local
npm run analyze ./logs/app.log -- --prompt-only       # imprime prompt, sem API
npm run analyze ./logs/app.log -- --llm=ollama        # local LLM
npm run analyze ./logs/app.log -- --llm=anthropic     # cloud (precisa key)
npm run analyze ./logs/app.log -- --llm=openai        # OpenAI-compatible
npm run analyze ./logs/app.log -- --help              # mostra todos os flags
```

## As 7 camadas locais

### 1. Parse

Lê o arquivo, tenta `JSON.parse` em cada linha. Mantém entries válidas; conta linhas não-JSON separadamente.

Suporta as 3 shapes do OIL: `default` (`level`+`timestamp`), `datadog` (`status`+`timestamp`), `elastic` (`log.level`+`@timestamp`). Funções `levelOf`/`tsOf`/`traceOf` aceitam qualquer um.

### 2. Cluster por mensagem normalizada

UUIDs, hex (0x…) e dígitos longos (`\d{2,}`) são substituídos por placeholders genéricos antes do agrupamento. Resultado: variações como `request abc-123 failed` e `request def-456 failed` viram o mesmo cluster.

Saída: top-N clusters ordenados por frequência, com nível, serviços envolvidos, primeira/última ocorrência.

### 3. Heurísticas regex

Seis padrões pré-definidos:

| Nome | Pattern | Dica que imprime |
|---|---|---|
| Timeout cascade | `timeout\|deadline exceeded\|ETIMEDOUT\|ECONNRESET\|context deadline` | "Check upstream latency, retry budgets, pool sizes" |
| Out of memory | `out of memory\|OOM\|heap out\|killed\|cannot allocate` | "Container limits, payload size, leak suspects" |
| Database failure | `deadlock\|connection refused\|too many connections\|constraint\|duplicate key\|relation .* does not exist` | "DB pool, recent migrations, index on join key" |
| Auth / 401-403 | `unauthorized\|forbidden\|invalid token\|jwt\|expired\|401\|403` | "Token rotation, clock skew, audience claim" |
| 5xx upstream | `5\d\d\|bad gateway\|service unavailable\|internal server error` | "Aggregate by upstream host" |
| Rate limit | `429\|rate.?limit\|too many requests\|throttle` | "One caller likely misconfigured" |

Casa contra a key normalizada do cluster, então `db.timeout: deadline exceeded on findOrder()` matcha `timeout cascade`.

### 4. Stack-trace dedup

Para entries com campo `stack`/`stack_trace`/`error.stack`, extrai as 3 primeiras frames, normaliza números de linha (`:42:10` → `:L`) e paths absolutos (`/full/path/node_modules/x` → `node_modules/x`), e agrupa.

Útil para descobrir "o mesmo bug se manifestou 500 vezes hoje".

### 5. Temporal cascade detection

Janela deslizante de 1 segundo sobre os timestamps. Sempre que ≥3 entries de erro caem no mesmo segundo, registra como cascata e imprime: início, fim, número de events, serviços envolvidos.

Esse é o sinal clássico de "uma coisa quebrou e propagou".

### 6. Per-minute anomaly via z-score

Agrega entries por minuto. Calcula média e desvio. Imprime minutos com z ≥ 2 (eventos por minuto bem acima do baseline).

Útil para detectar picos curtos em logs longos sem precisar de monitor externo.

### 7. Service interaction graph

Para entries com `trace_id`, agrupa por trace e extrai pares de serviços que aparecem no mesmo trace. Conta as ocorrências.

Saída: as 5 interações mais frequentes (e.g. `checkout-api ↔ auth-svc · 38 traces`). Isso revela a topologia real do tráfego sem precisar de tracer dedicado.

## Camada 8 — LLM opt-in (3 providers)

Quando você passa `--llm=<provider>`, o analyzer monta um prompt com o resumo das 7 camadas e envia ao provider escolhido:

### `--llm=anthropic` (cloud)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run analyze app.log -- --llm=anthropic
```

Variáveis opcionais:

- `ANTHROPIC_MODEL` (default: `claude-haiku-4-5`)

Endpoint: `https://api.anthropic.com/v1/messages`. Modelo default é o haiku (fast, cheap). Para análise profunda em incidentes grandes, prefira `sonnet`.

### `--llm=ollama` (local)

```bash
# 1. Instale Ollama (uma vez): https://ollama.com
# 2. Baixe um modelo:
ollama pull llama3.1
# 3. Rode:
npm run analyze app.log -- --llm=ollama
```

Variáveis opcionais:

- `OLLAMA_HOST` (default: `http://localhost:11434`)
- `OLLAMA_MODEL` (default: `llama3.1`)

Endpoint: `<OLLAMA_HOST>/api/chat`. Funciona 100% local — nenhum dado sai da sua máquina. Latência típica em laptop com GPU: 5–15 s para a resposta inteira.

### `--llm=openai` (compatible endpoint)

```bash
# OpenAI direto:
export OPENAI_API_KEY=sk-...
npm run analyze app.log -- --llm=openai

# Ou LM Studio local:
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=qwen2.5-coder-32b
npm run analyze app.log -- --llm=openai
# (sem API key — LM Studio aceita anônimo)

# Ou vLLM, Together, Groq, Perplexity, etc — qualquer endpoint compatível.
```

Variáveis:

- `OPENAI_API_KEY` (obrigatório se o base é `api.openai.com`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

### `--prompt-only`

Imprime o prompt formatado para você colar no chat de sua escolha (claude.ai, ChatGPT, etc) sem fazer nenhuma chamada. Útil quando você não quer dar API key ao analyzer.

## Anatomia de uma run

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

## Como o prompt é montado (para os curiosos)

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

O LLM responde com prose em markdown. A saída é impressa no stdout — você pode redirecionar para arquivo (`> diagnosis.md`).

## Limitações conhecidas

- O parsing **pula linhas não-JSON sem warning detalhado**. Se seu log é misto JSON + texto, considere `grep '^{' app.log | npm run analyze /dev/stdin -- ...` (que ainda não funciona — workaround: salvar em arquivo limpo primeiro).
- A janela do anomaly z-score é **por minuto fixo**. Bursts de < 60s não aparecem aqui (eles aparecem na seção "Temporal cascades").
- O LLM mode não envia **valores redatados** (`[REDACTED]`), mas envia o pattern do cluster (e.g. `password mismatch for user N`). O texto da mensagem em si vai para o LLM. Se sua aplicação loga texto livre com PII, redacte na camada de aplicação antes.

## Próximo passo

→ [10 · Performance](10-performance.md) — números honestos, tuning, hot-path notes.
