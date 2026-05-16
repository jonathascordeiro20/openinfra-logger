# 10 · Performance

[← back to manual index](README.md)

> Esta seção dá números **honestos** e descreve onde os ciclos de CPU vão dentro do `log()`. Não é uma comparação contra Pino / Winston / zap / structlog — para isso, copie `benchmarks/node-baseline.js`, troque a lib e rode ambos no mesmo hardware.

## Baseline Node (Node 24, Windows, AMD Ryzen-class)

Rodando `node benchmarks/node-baseline.js` (com console stubbed para `/dev/null`):

| Métrica | Valor |
|---|---|
| Single-call latency p50 | ~ 99 µs |
| Single-call latency p95 | ~ 156 µs |
| Single-call latency p99 | ~ 226 µs |
| Throughput (loop apertado, 2 s) | ~ 10 000 events/sec |
| Redaction overhead (4 keys, 1 nested) | ~ 96 µs/call |

Esses números são **environment-dependent**. Reproduza no seu hardware antes de publicar claims.

## Onde os ciclos vão (hot path)

```
log()
 ├─ 1. Date.now() / Date.toISOString()    ~ 2 µs
 ├─ 2. spread merge defaultMetadata        ~ 5 µs
 ├─ 3. try/catch + getActiveSpan (otel)    ~ 3 µs (sem otel: ~0.5 µs)
 ├─ 4. spread merge metadata               ~ 5 µs
 ├─ 5. formatter rename (datadog/elastic)  ~ 1 µs (default: 0)
 ├─ 6. redactObject recursive              ~ 95 µs (4 keys + 1 nested)
 ├─ 7. JSON.stringify                      ~ 20 µs
 └─ 8. dispatch to transports              ~ varies
```

A redação é o **gargalo dominante** num payload modesto. Se você não tem campos sensíveis e não quer pagar isso:

```js
configure({ redactKeys: [] });
```

Sem redação, o p50 cai para ~ 35 µs e o throughput sobe para ~ 22 000 events/sec.

## Tuning para diferentes perfis

### "API REST típica" (50–500 events/sec/proc)

Defaults estão bem. Não tune nada.

### "Worker com burst" (5k–20k events/sec/proc por segundos)

```js
configure({
  // Sem redação se o worker não toca PII
  redactKeys: [],
  // Buffer maior se você usa remote — menos POSTs em alta carga
  batchSize: 500,
  flushIntervalMs: 1000,
});
```

### "Edge / serverless" (curtos, sem persistência)

```js
configure({
  transports: ['console'],   // o agente do edge coleta isso
  // Sem file (não tem disco), sem remote (latência de cold start)
  redactKeys: ['password','token','secret','api_key','credit_card'],
});
```

### "Lambda / Cloud Run sem agente"

```js
configure({
  transports: ['console', 'remote'],
  remoteUrl: process.env.LOG_URL,
  // Funções são curtas — flush mais agressivo
  batchSize: 25,
  flushIntervalMs: 500,
});

// E SEMPRE no graceful shutdown:
process.on('beforeExit', () => {
  // v0.1 não expõe flush() — issue aberta. Workaround:
  // dorme 600 ms para garantir que o último batch saiu antes de exit
});
```

## Hot-path notes — Python

- `datetime.datetime.now(datetime.timezone.utc).isoformat()` é ~3× mais lento que `time.time()`. Em workloads ultra-quentes (>50k events/sec/proc), considere abrir uma issue propondo um modo "epoch_millis" para timestamp.
- O `threading.Timer` do remote transport tem cost de criação. Em produção com `batch_size=1` (que dispara timer a cada log), o overhead é notável. Sempre use `batch_size>=10`.

## Hot-path notes — Go

- A serialização é via `encoding/json`, que reflectiv. Em workloads ultra-quentes, considere `easyjson` ou `goccy/go-json` num fork seu.
- O `dispatch` cria uma goroutine por POST no remote transport. Sob 10k+ events/sec, isso satura o net pool. Implemente um worker pool fixo na sua wrapper (ou aguarde v0.2).

## Hot-path notes — Rust

- A struct `Config` usa `HashMap<String, String>` para metadata. Hashing de string é mais caro que necessário. A v0.2 vai trocar para `BTreeMap` ou um wrapper com chaves enum-discriminadas.
- O JSON builder hand-rolled é, surpreendentemente, **mais rápido** que `serde_json` nesse caso específico (sem types, sem schema), porque evita a alocação intermediária do `serde_json::Value`. Beneficiário: latência consistente; perdedor: extensibilidade.

## Quando OIL **não é** a escolha certa de perf

- Você precisa de **> 50k events/sec/proc no Node** com cardinalidade alta. Pino é a resposta.
- Você precisa de **flush garantido em < 1ms** após o `log()`. Considere logging assíncrono com fila persistente (Kafka client direto).
- Você precisa de **comportamento determinístico em tempo real** (motorsports, trading). OIL faz alocações; não tem heap pre-allocado. Você quer uma lib zero-alloc.

## Como reproduzir o benchmark

```bash
cd C:/Users/jonat/openinfra-logger
node benchmarks/node-baseline.js
```

O código está em `benchmarks/node-baseline.js`. Modifique e PRs com novos baselines (Python, Go, Rust) são bem-vindas.

## Próximo passo

→ [11 · Migration guides](11-migration.md) — saindo de Pino, Winston, structlog, zap.
