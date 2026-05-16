# 12 · Troubleshooting

[← back to manual index](README.md)

Sintoma → causa provável → correção. Se nada aqui resolve, abra uma issue com o output de `log('test', 'info', { check: true })` e a sua configuração.

## Logs não aparecem

| Sintoma | Causa provável | Correção |
|---|---|---|
| Nada em stdout/stderr | `transports: []` | Coloque `transports: ['console']` ou pelo menos um transport ativo |
| Nada em arquivo | `filePath` aponta para diretório sem permissão de escrita | `chmod +w` no diretório, ou aponte para `/tmp/...` para testar |
| Nada em arquivo, mas o processo tem permissão | Filesystem read-only (containers endurecidos) | Use volume montado RW, ou troque `file` por `remote` |
| Logs em stderr (Python) inesperado | Comportamento intencional — Python loga em stderr | OK se isso for um problema, capture com `2>&1` |

## Logs em ordem errada (Node, file transport)

| Sintoma | Causa | Correção |
|---|---|---|
| Linhas em arquivo aparecem na ordem A, C, B | Bug em pre-0.1.0 — corrigido. Confirme a versão | `npm ls @jonathascordeiro20/openinfra-logger` deve mostrar ≥ 0.1.0 |
| Linhas ainda fora de ordem em 0.1.0+ | Outro processo escrevendo no mesmo arquivo | Cada processo precisa do seu próprio `filePath` |

## Nível inválido

| Sintoma | Causa | Correção |
|---|---|---|
| `log('msg', 'verbose')` emite com `"level":"info"` e um warning | Comportamento intencional desde v0.1.0 | Use apenas `debug` / `info` / `warn` / `error` |
| Quero suprimir o warning de fallback | Não exposto em v0.1.0 | Abra issue ou faça lint de nível antes da chamada |

## Redação não funcionando

| Sintoma | Causa provável | Correção |
|---|---|---|
| `password: 'secreto'` ainda aparece em texto plano | `redactKeys: []` foi passado em algum `configure()` | Confira a lista efetiva — `configure({ redactKeys: ['password', ...] })` sobrescreve |
| `passwd` não foi redatado | Não está nos defaults | Adicione `'passwd'` à lista de `redactKeys` |
| `authorization` no header não foi redatado | Não está nos defaults | Adicione `'authorization'` e `'cookie'` à lista |
| Valor sensível no `message` aparece | `message` **não é redatado** (texto livre) | Mova o valor pro `metadata`: `log('login', 'info', { password: pw })` |
| Stack trace contém valor | Stack é uma string livre | Limpe antes: `log('failed', 'error', { error_type: e.name, error_msg: e.message })` (sem `e.stack`) |

## Remote transport não enviando

| Sintoma | Causa provável | Correção |
|---|---|---|
| `console.error: Failed to send remote logs batch` | Endpoint retornando ≥400 | Verifique `remoteUrl`, headers, e CORS |
| Batch demora 2s para enviar | Default `flushIntervalMs: 2000` | Reduza para 500 se quiser flush mais agressivo |
| Em Lambda/serverless, último batch perdido no exit | Processo morre antes do timer disparar | Workaround: `await new Promise(r => setTimeout(r, 600))` antes de exit. Issue aberta para expor `flush()` síncrono em v0.2 |
| Em produção com 10k+ events/sec, latência alta | Buffer interno cresce sem backpressure | Reduza `batchSize` para 25 e use shipper local (Vector → backend) |

## Tag Go não resolvendo

| Sintoma | Causa | Correção |
|---|---|---|
| `go get .../openinfra-logger/go@v0.1.0` retorna "no matching versions" | Tag de subpath faltando | A v0.1.0 já tem `go/v0.1.0`. Force com `GOPROXY=https://proxy.golang.org go get .../v0.1.0` |
| `go: module github.com/.../go: invalid version v0.1.0` | Você usou `@v0.1.0` em vez de `@go/v0.1.0` no proxy direto | Use a forma normal `@v0.1.0` — o Go resolve o prefixo automaticamente com o module path correto |

## docs.rs não tem documentação

| Sintoma | Causa | Correção |
|---|---|---|
| `docs.rs/openinfra-logger` retorna "no docs" | Build ainda em fila | Espera 5–15 min após publish |
| Build da doc falhou | Erro no source que docs.rs flag | Cheque `https://docs.rs/crate/openinfra-logger/latest/builds` |

## PyPI mostra metadata errado

| Sintoma | Causa | Correção |
|---|---|---|
| Long description sem render | `pyproject.toml` sem `readme = "README.md"` | A v0.1.0 já tem; se forkou, confira |
| Classifiers errados (e.g. "Beta" quando você quer "Production") | Hardcoded em `pyproject.toml` | Mude e re-publique como v0.2 |
| Description longa truncada | Limit do PyPI ~512 chars no `description` | Texto longo vai no README, não no `description` |

## Build / publish

| Sintoma | Causa | Correção |
|---|---|---|
| `cargo publish: A verified email address is required` | E-mail não verificado em crates.io | <https://crates.io/settings/profile> → adicione e-mail → clique no link recebido |
| `cargo publish: no token found` | Falta `cargo login` | `cargo login <TOKEN>` ou `$env:CARGO_REGISTRY_TOKEN="..."` |
| GitHub workflow `publish-pypi.yml` falha com "OIDC claim mismatch" | Pending publisher no PyPI com `Repository` errado | Cheque <https://pypi.org/manage/account/publishing/> — deve ser `jonathascordeiro20/openinfra-logger`, não duplicação do owner |
| Workflow falha por environment | `environment: pypi` no YAML mas não existe no repo | Crie em Settings → Environments → New environment → "pypi" |

## OpenTelemetry não aparece

| Sintoma | Causa | Correção |
|---|---|---|
| `trace_id` não aparece mesmo com OTel ativo | Span fora do contexto da chamada `log()` | Confira que `log()` está dentro do callback de `startActiveSpan` / context manager |
| Em Python: `ImportError: opentelemetry` no log | OIL **não** falha — `try/except ImportError` silencia | Sem ação. Se quiser detecção, instale `pip install opentelemetry-api` |
| Em Node, `trace_id` aparece em handler síncrono mas não em `setTimeout` | OTel context perdido em callback async | Use `context.with(...)` ou `AsyncLocalStorage` no Node 16+ |

## Como reportar bug

1. Versão exata: `npm ls @jonathascordeiro20/openinfra-logger`, `pip show openinfra-logger`, etc
2. Runtime: `node --version`, `python --version`, `go version`, `rustc --version`
3. Sistema: `uname -a` (Linux/macOS) ou `ver` (Windows)
4. Snippet **mínimo** que reproduz
5. Output esperado vs output observado
6. Issue: <https://github.com/jonathascordeiro20/openinfra-logger/issues/new/choose>

## Próximo passo

→ [13 · FAQ](13-faq.md) — perguntas que sempre voltam.
