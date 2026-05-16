# 05 · Transports

[← back to manual index](README.md)

Um **transport** é o canal de saída de uma entrada de log. OIL ativa transports pela lista `transports`. Múltiplos transports rodam em paralelo; falha de um não afeta os outros.

## Console transport

### Como funciona

Cada `log()` chama o stream apropriado do runtime:

| Nível | Node | Python | Go | Rust |
|---|---|---|---|---|
| `debug` | `console.debug` (stdout) | `_logger.debug` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `info` | `console.log` (stdout) | `_logger.info` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `warn` | `console.warn` (stderr) | `_logger.warning` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |
| `error` | `console.error` (stderr) | `_logger.error` (stderr) | `fmt.Println` (stdout) | `println!` (stdout) |

> **Atenção (Python):** o logger interno do Python usa `StreamHandler` que escreve em **stderr** por padrão. Se você está redirecionando stdout em testes, os logs continuam aparecendo em stderr. Isso é proposital — separa logs de output de programa.

> **Atenção (Go / Rust):** v0.1 envia tudo para stdout, ignorando o nível. v0.2 vai diferenciar `warn`/`error` para stderr no Go e no Rust.

### Quando usar

- **Sempre**, em qualquer ambiente. É o transport mais barato e o mais útil para Docker / Kubernetes que coletam stdout/stderr automaticamente.
- Em produção atrás de um agente (Datadog Agent, fluent-bit, Vector), `console` é o **único** transport que você costuma precisar.

### Quando não usar

- Em CLIs interativas onde JSON polui a saída do usuário — você não vai colocar `transports: ['console']` numa ferramenta como `git status`. Para CLIs, considere `transports: ['file']` apontando para `~/.cache/seu-app/log.jsonl`.

## File transport

### Como funciona

Cada `log()` faz **append** ao arquivo em `filePath`. O modo de abertura é "append + create":

```
node:   fs.appendFile(path, line + '\n', cb)  ← async, serializado por chain
python: open(path, 'a').write(line + '\n')    ← sync, sem race
go:     os.OpenFile(path, O_APPEND|O_CREATE)  ← sync per call
rust:   OpenOptions::new().create().append()  ← sync per call
```

### Ordenação sob escrita concorrente

Esse é o detalhe que muita gente subestima.

```
Naive implementation:
  log("A"); log("B"); log("C");

  Async runtime (Node):
    fs.appendFile starts 3 simultaneous syscalls
    → linhas podem aparecer como A, C, B
```

OIL no Node **encadeia escritas via Promise**:

```js
let fileWriteChain = Promise.resolve();
function appendToFileOrdered(filePath, line) {
  fileWriteChain = fileWriteChain.then(() =>
    new Promise(resolve => fs.appendFile(filePath, line, () => resolve()))
  );
  return fileWriteChain;
}
```

Isso garante que linhas aparecem **na ordem em que `log()` foi chamado**. Custo: pequena latência adicional no hot path quando há contenção (~5–15µs/call sob 1k QPS).

Em Python / Go / Rust o write é sync, então a ordem é natural.

### Permissões e rotação

- O arquivo é criado com permissões padrão do umask (geralmente `0644`).
- **OIL não faz rotação.** Use `logrotate`, `multilog`, ou um shipper (fluent-bit) que faz rotação a montante.
- Se o arquivo é apagado externamente enquanto OIL está aberto (Linux): **as escritas continuam num inode órfão**. Você não vai ver mais logs no novo arquivo. Isso é uma armadilha clássica do `logrotate` — use `copytruncate` ou envie um sinal pra recriar o handle.

### Quando usar

- **Compliance / auditoria** que exige logs em disco no mesmo host.
- **Fallback** quando o remote transport falha — escreva em arquivo, deixe um shipper enviar depois.
- **Debug local** quando você quer `tail -f` no shell.

### Quando não usar

- **Em containers stateless** sem volume montado — você perde os logs no `kubectl delete pod`.
- **Em filesystems read-only** (que é o que você quer em produção endurecida) — o write vai falhar silenciosamente, com mensagem em stderr.

## Remote transport

### Como funciona

```
                      ┌───────────────┐
log() ──────────────▶ │ in-memory     │
                      │ buffer (FIFO) │
                      └─┬─────┬───────┘
                        │     │
       batchSize=100 ───┘     └─── timer flushIntervalMs=2000
       reached                     fires
                        │     │
                        ▼     ▼
                  ┌────────────────┐
                  │ POST as a JSON │
                  │ array body     │
                  └────────────────┘
```

A primeira chamada `log()` enche o buffer. Dois gatilhos disparam um POST:

1. **Por tamanho:** quando `buffer.length === batchSize` (default 100), o flush é imediato.
2. **Por tempo:** quando o primeiro item entra no buffer, um timer (`flushIntervalMs`, default 2000ms) é agendado; ao disparar, faz flush do que houver.

O timer é cancelado e re-agendado a cada flush por tamanho, então a janela é "no máximo 2 s desde o **primeiro** item do batch atual".

### O que sobe na rede

```json
[
  { "timestamp": "...", "level": "info", "message": "evt1", ... },
  { "timestamp": "...", "level": "info", "message": "evt2", ... },
  ...
]
```

Um array JSON, não NDJSON. Razão: Datadog API, Elastic Bulk, e Loki Push aceitam payloads de array; NDJSON exige Content-Type específico ou wrappers. Se você precisar de NDJSON, sirva via shipper local (`vector`/`fluent-bit`) lendo do transport `console`.

### Falhas

Se o POST falhar (timeout, 5xx, conexão recusada):

- **Node:** o `.catch()` no `fetch` escreve uma mensagem de erro no `console.error` e descarta o batch. Buffer NÃO é re-enfileirado.
- **Python:** `try/except` em torno do `urlopen`, mesma estratégia.
- **Go:** `client.Do(req)` em goroutine; erros são silenciosos (fire-and-forget).

Isso é proposital: **não bloqueamos o processo da aplicação por causa de falha de log**. Se você precisa de garantia de entrega, ponha um shipper local no caminho (Vector → buffer em disco → backend) e use OIL com `console` para alimentar o shipper.

### Quando usar

- Quando você não tem agente local e quer mandar JSON direto para `logs.example.com/ingest`.
- Em arquiteturas serverless onde o stdout não é coletado de forma confiável.

### Quando não usar

- Em produção crítica sem retry de borda. Use `console` + agente.
- Sob altíssima cardinalidade de log (>10k QPS) — o batch sync vai ficar enorme. Reduza `batchSize` para 25 e `flushIntervalMs` para 500.

## Múltiplos transports simultâneos

```js
configure({ transports: ['console', 'file', 'remote'], ... });
log('hello', 'info');
```

Comportamento:

1. JSON é montado uma vez.
2. **Redaction** é aplicada **uma vez** sobre a entry (não por transport).
3. Cada transport recebe o **mesmo string** redatado.
4. Falha em um não afeta os outros.

Ordem de dispatch interna: console → file → remote. Não há garantia de que a entrada apareça no console **antes** do file write completar — os três rodam em paralelo (na medida do possível, dado o single-threaded event loop em Node/Python).

## Próximo passo

→ [06 · Formatters](06-formatters.md) — `default`, `datadog`, `elastic` campo-a-campo.
