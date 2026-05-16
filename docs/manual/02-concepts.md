# 02 · Conceitos

[← back to manual index](README.md)

## O contrato JSON

Toda chamada `log(message, level, metadata)` produz uma linha JSON com pelo menos estes campos:

| Campo | Tipo | Sempre presente? | Notas |
|---|---|---|---|
| `timestamp` | string ISO-8601 com `Z` final | sim (formatter `default`) | renomeia para `@timestamp` no formatter `elastic` |
| `level` | string em minúsculas | sim (formatter `default`) | renomeia para `status` (datadog) ou `log.level` (elastic) |
| `message` | string | sim | livre |
| campos de `defaultMetadata` | qualquer JSON-serializable | quando configurado | merge global |
| `trace_id` / `span_id` | string hex | quando há span OTel ativo | renomeia para `dd.trace_id`/`dd.span_id` no datadog |
| campos do `metadata` da chamada | qualquer JSON-serializable | quando passado | **sobrescreve** os anteriores (caller wins) |

### Ordem de merge

```
       ┌──────────────────┐
       │ 1. timestamp     │
       │ 2. level         │
       │ 3. message       │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 4. defaultMetadata (de configure()) │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 5. trace context (extract_trace_context()) │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 6. metadata da chamada (caller wins) │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 7. formatter (default/datadog/elastic) │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 8. redaction (recursive)             │
       └──────────────────┘
              ↓
       ┌──────────────────┐
       │ 9. JSON.stringify → transports       │
       └──────────────────┘
```

Esse pipeline é determinístico e idêntico nas quatro implementações.

## Os quatro níveis

```
debug = 10     dev-only spam, deeply technical
info  = 20     normal flow, business events
warn  = 30     attention but no human action yet
error = 40     attention now, on-call relevance
```

Níveis inválidos caem silenciosamente para `info` (com um warning estruturado em stderr explicando o que aconteceu — só uma vez por nível desconhecido na sessão).

## Os três transports

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  console   │  │   file     │  │   remote   │
├────────────┤  ├────────────┤  ├────────────┤
│ stdout/    │  │ append-    │  │ POST batch │
│ stderr     │  │ only, .log │  │ to URL,    │
│ JSON line  │  │ JSON line  │  │ buffered   │
│ per call   │  │ per call,  │  │ N or T ms  │
│            │  │ ordered    │  │            │
└────────────┘  └────────────┘  └────────────┘
```

A lista `transports: ['console','file','remote']` dispara os três simultaneamente. Cada um é independente — falha de um não interrompe os outros.

Detalhes operacionais em [05 · Transports](05-transports.md).

## Os três formatters

| Formatter | `timestamp` | `level` | `trace_id` | `span_id` |
|---|---|---|---|---|
| `default` | `timestamp` | `level` | `trace_id` | `span_id` |
| `datadog` | `timestamp` | `status` | `dd.trace_id` | `dd.span_id` |
| `elastic` | `@timestamp` | `log.level` | `trace_id` | `span_id` |

Detalhes em [06 · Formatters](06-formatters.md).

## A regra do auto-redaction

```
For every value V in the log entry:
  if V is a dict / object:
    for every key K, V[K]:
      if K.lower() in redactKeys:
        V[K] = "[REDACTED]"
      else:
        recurse into V[K]
  if V is a list / array:
    recurse into every element
  else:
    leave V as-is
```

Defaults: `password`, `token`, `secret`, `api_key`, `credit_card`. Casos-limite em [07 · Auto-redaction](07-redaction.md).

## A arquitetura por runtime

Cada implementação tem cinco peças, escritas só com a stdlib:

```
┌──────────────────────────────────────────────────────────────────┐
│                          public API                              │
│  log(message, level, metadata)   configure(...)                  │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              ↓               ↓                   ↓
   ┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐
   │ default metadata │ │ trace ctx    │ │ caller metadata │
   │ merge            │ │ extract      │ │ merge           │
   └──────────────────┘ └──────────────┘ └─────────────────┘
                              │
                              ↓
                ┌─────────────────────────┐
                │ formatter (datadog/...) │
                └─────────────────────────┘
                              │
                              ↓
                ┌─────────────────────────┐
                │ redactObject (recursive)│
                └─────────────────────────┘
                              │
                              ↓
   ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
   │  console     │ │  file        │ │  remote (batch)  │
   │  fmt.Println │ │  append+chain│ │  HTTP POST       │
   └──────────────┘ └──────────────┘ └──────────────────┘
```

A diferença entre runtimes está na implementação:

- **Node:** `Promise`-chain serializa append em arquivo, `setTimeout` agenda flush remoto.
- **Python:** `threading.Timer` agenda flush remoto, `urllib.request.urlopen` faz POST.
- **Go:** `fmt.Println` direto, `os.OpenFile`, `goroutine` fire-and-forget para remote.
- **Rust:** zero-dep JSON builder (`escape_json_string` RFC 8259-compliant), `OpenOptions`.

## Zero-dependency claim

O que a frase quer dizer:

```
✓  npm install @jonathascordeiro20/openinfra-logger
   → 0 transitive packages installed

✓  pip install openinfra-logger
   → 0 transitive packages installed

✓  cargo add openinfra-logger
   → 0 transitive crates compiled

✓  go get github.com/jonathascordeiro20/openinfra-logger/go
   → 0 transitive modules added
```

O que a frase **não** quer dizer:

- **Não** significa "zero network calls". O remote transport faz HTTP. O log analyzer com `--llm=anthropic` chama uma API externa. O OpenTelemetry hook não chama nada, mas requer que **você** já tenha `@opentelemetry/api` ou `opentelemetry-api` instalado se quiser que ele detecte spans.
- **Não** significa "compatível com `no_std` em Rust" — a v0.1 usa `std::fs` para o file transport. Uma variant `no_std` está no roadmap.
- **Não** significa que os testes não usam deps — usam o framework de teste de cada linguagem (`node:test`, `unittest`, `testing`, `cargo test`). Isso é zero dep em **produção**, não em desenvolvimento.

A interpretação corretamente narrada: **"o pacote em si não traz nenhum outro pacote para a sua árvore de dependências"**.

## Próximo passo

→ [03 · Instalação](03-installation.md) — versões mínimas, comando exato por runtime, e como validar que o install funcionou.
