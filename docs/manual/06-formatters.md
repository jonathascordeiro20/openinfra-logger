# 06 · Formatters

[← back to manual index](README.md)

Um **formatter** é uma transformação aplicada ao JSON da entrada **depois** do merge de metadata e **antes** da redação. Existem 3 em v0.1: `default`, `datadog`, `elastic`.

## Quando usar qual

| Você usa… | Use o formatter… |
|---|---|
| stdout que algum agente (Datadog Agent, fluent-bit, Vector) já normaliza | `default` |
| Datadog HTTP intake direto, sem agente | `datadog` |
| Elastic / OpenSearch / Logstash que ingere ECS | `elastic` |
| Loki, Splunk, CloudWatch | `default` (LogQL e Splunk Search aceitam shape canônico) |
| Backend customizado da sua empresa | `default` |

## Comparação campo-a-campo

Entrada (antes do formatter):

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

### `formatter: 'default'`

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

(idêntico — sem transformação)

### `formatter: 'datadog'`

```json
{
  "timestamp": "2026-05-16T03:42:01.041Z",
  "status": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "dd.trace_id": "a4f1c9d3",
  "dd.span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

Mapeamentos:

| Original | Vira |
|---|---|
| `level` | `status` |
| `trace_id` | `dd.trace_id` |
| `span_id` | `dd.span_id` |

Os demais campos são preservados.

### `formatter: 'elastic'`

```json
{
  "@timestamp": "2026-05-16T03:42:01.041Z",
  "log.level": "info",
  "message": "order.placed",
  "service": "checkout-api",
  "trace_id": "a4f1c9d3",
  "span_id": "b3d8e2f7",
  "order_id": "o_4419"
}
```

Mapeamentos:

| Original | Vira |
|---|---|
| `timestamp` | `@timestamp` |
| `level` | `log.level` |
| `trace_id` | (mantém — ECS aceita assim) |
| `span_id` | (mantém) |

## Edge cases

### O `service` em ECS

O ECS prefere `service.name` em vez de `service` no top level. OIL não faz essa renomeação automaticamente em v0.1 — se você quer estritamente ECS, passe `service.name` no `defaultMetadata`:

```js
configure({
  formatter: 'elastic',
  defaultMetadata: {
    'service.name': 'checkout-api',
    'service.environment': 'production',
  },
});
```

### O `trace_id` sem span

Se nenhum span OTel está ativo, OIL **não emite** `trace_id` (e portanto também não emite `dd.trace_id`). Nada aparece com valor `null` ou `""`. O Datadog/Elastic não recebe uma key vazia.

### Caller wins, sempre

Se você passar `trace_id` explicitamente no metadata, OIL respeita:

```js
log('msg', 'info', { trace_id: 'manual-trace-123' });
```

Sai como `trace_id: "manual-trace-123"` (ou `dd.trace_id: "manual-trace-123"` no formatter datadog). Útil para emular um span de teste ou backfill.

### Misturar formatter com defaultMetadata

```js
configure({
  formatter: 'datadog',
  defaultMetadata: { service: 'api', status: 'override' }, // ← cuidado
});

log('test', 'info');
// → { "timestamp": "...", "message": "test", "status": "override", ... }
```

O `defaultMetadata.status` **sobrescreve** o que o formatter datadog injetou (porque o formatter roda antes do merge final). Em geral, **não use** chaves que colidem com os mapeamentos do formatter. Use os nomes neutros (`level`, `trace_id`) e deixe o formatter fazer o trabalho.

## Como adicionar um formatter customizado

Em v0.1.0 a lista de formatters é fixa no código. Para um formatter custom (e.g. Splunk com prefixo `splunk.`), você tem duas opções:

1. **Pre-pos no defaultMetadata.** Funciona para 80% dos casos.
2. **Pipeline shipper.** Configure OIL com `default` e converta no fluent-bit/Vector — é onde mapeamentos custom realmente pertencem.

A v0.2 vai permitir passar uma função `formatter: (entry) => entry`. Issue aberta no [GitHub](https://github.com/jonathascordeiro20/openinfra-logger/issues) — PRs bem-vindos.

## Compatibilidade com a chain

O formatter sempre roda **antes** da redação:

```
1. merge metadata
2. formatter           ← renomeia keys (level → status, etc)
3. redaction           ← agora opera sobre os nomes renomeados
4. JSON.stringify
```

Implicação prática: se você tem `redactKeys: ['status']` (incomum, mas hipoteticamente), e usa o formatter datadog, **o `status` da datadog vai virar `[REDACTED]`**. Por isso a redact list default só tem nomes universalmente sensíveis.

## Próximo passo

→ [07 · Auto-redaction](07-redaction.md) — algoritmo recursivo, casos limítrofes, e quando ele **não** te salva.
