# 08 · OpenTelemetry integration

[← back to manual index](README.md)

OIL detecta um span ativo do OpenTelemetry em tempo de chamada e injeta `trace_id` e `span_id` na entrada do log. **Zero configuração.** Você precisa apenas que o OTel já esteja instalado e ativo no processo.

## Como funciona

A função de extração é defensiva — funciona se o OTel está instalado, falha silenciosamente se não:

```js
// Node implementation (simplificado)
function extractTraceContext() {
  try {
    const otel = require('@opentelemetry/api');
    const span = otel.trace.getActiveSpan();
    if (span) {
      const ctx = span.spanContext();
      if (otel.trace.isSpanContextValid(ctx)) {
        return { trace_id: ctx.traceId, span_id: ctx.spanId };
      }
    }
  } catch (e) { /* OTel not installed, ignore */ }
  return {};
}
```

A função roda em **toda** chamada `log()` (custo: ~3µs/call com OTel instalado, ~0.5µs sem).

## Suporte por runtime

| Runtime | Suporte | Pacote esperado |
|---|---|---|
| **Node** | ✓ auto | `@opentelemetry/api` |
| **Python** | ✓ auto | `opentelemetry-api` (já instalado se você passar o extra `[opentelemetry]`) |
| **Go** | — | (roadmap v0.2) |
| **Rust** | — | (roadmap v0.2) |

## Exemplo end-to-end — Node

```js
const { trace } = require('@opentelemetry/api');
const { log } = require('@jonathascordeiro20/openinfra-logger');

// Você configurou OTel em outro lugar (provider, exporter, etc).
const tracer = trace.getTracer('demo');

tracer.startActiveSpan('process-order', (span) => {
  log('starting', 'info', { order_id: 'o_4419' });
  // → "trace_id":"a4f1c9…","span_id":"b3d8e2…","order_id":"o_4419"

  // alguma lógica…

  log('completed', 'info', { order_id: 'o_4419', status: 'ok' });
  // → mesmo trace_id, MESMO span_id

  span.end();
});

// Fora do span:
log('idle', 'info');
// → "trace_id" e "span_id" NÃO aparecem
```

## Exemplo end-to-end — Python

```python
from opentelemetry import trace
from openinfra_logger import log

tracer = trace.get_tracer("demo")

with tracer.start_as_current_span("process-order"):
    log("starting", "info", {"order_id": "o_4419"})
    # → "trace_id":"a4f1c9…","span_id":"b3d8e2…"
```

## Como aparece nos formatters

Sem formatter ou com `formatter: 'default'`:

```json
{ "trace_id": "a4f1c9d3…", "span_id": "b3d8e2f7…", ... }
```

Com `formatter: 'datadog'`:

```json
{ "dd.trace_id": "a4f1c9d3…", "dd.span_id": "b3d8e2f7…", ... }
```

Com `formatter: 'elastic'`:

```json
{ "trace_id": "a4f1c9d3…", "span_id": "b3d8e2f7…", ... }
```

(ECS aceita os nomes originais; v0.2 vai oferecer `trace.id`/`span.id` se você precisar de ECS estrito.)

## Quando o trace context **não** aparece

1. **OTel não está instalado** — sem package no `node_modules`/`site-packages`, o try-catch silenciosa o ImportError. Custo zero, comportamento limpo.
2. **Span ativo não existe no contexto** — `getActiveSpan()` retorna undefined fora de um `startActiveSpan` / context manager.
3. **Span é `NonRecordingSpan` ou inválido** — `isSpanContextValid` retorna false; OIL pula a injeção.
4. **Você está em uma callback assíncrona que perdeu o context** — `setTimeout`, `process.nextTick`, etc., precisam de propagação manual via OTel context API. OIL não faz isso por você.

## Vendor lock-in?

Não. O OTel API package é o padrão aberto. Se você usa Honeycomb, Lightstep, Tempo, Jaeger, ou o agente do Datadog que fala OTel — todos expõem trace context via `@opentelemetry/api`. OIL não tem conhecimento do backend.

## Quando você **não** quer a injeção

Use case raro: você quer logar fora de um span sem que OIL tente extrair contexto.

A v0.1 **sempre** tenta extrair (o overhead é baixíssimo). Se isso for um problema demonstrado em profile real, abra uma issue — o flag `disableOtelExtraction: true` é trivial de adicionar e podemos cuidar disso para v0.2.

## Combinando trace context com defaultMetadata

A ordem de merge é:

```
1. timestamp/level/message
2. defaultMetadata
3. trace context        ← override
4. metadata da chamada  ← override final
```

Implicação: você pode **forçar** um trace_id passando no metadata:

```js
log('replay', 'info', { trace_id: 'manual-replay-123' });
// → "trace_id":"manual-replay-123" (mesmo dentro de um span ativo!)
```

Útil para backfill, replay de eventos, ou correlação entre sistemas que não compartilham OTel.

## Próximo passo

→ [09 · Log analyzer](09-analyzer.md) — CLI local + LLM opt-in (3 providers).
