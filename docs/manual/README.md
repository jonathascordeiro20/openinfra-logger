# OpenInfra Logger — Manual

> Manual completo da v0.1.0. Para um quickstart de 5 minutos por runtime, veja [`docs/quickstart-node.md`](../quickstart-node.md), [`docs/quickstart-python.md`](../quickstart-python.md), [`docs/quickstart-go.md`](../quickstart-go.md) ou [`docs/quickstart-rust.md`](../quickstart-rust.md).

## Sumário

1. [Overview](01-overview.md) — quem é, para quem, em uma página
2. [Conceitos](02-concepts.md) — o JSON shape canônico, a arquitetura, as decisões de design
3. [Instalação](03-installation.md) — Node, Python, Go, Rust, versões mínimas, verificação
4. [Configuração](04-configuration.md) — todos os campos, defaults e gotchas por runtime
5. [Transports](05-transports.md) — `console`, `file`, `remote`; ordenação, batching, falhas
6. [Formatters](06-formatters.md) — `default`, `datadog`, `elastic`; mapeamento campo-a-campo
7. [Auto-redaction](07-redaction.md) — algoritmo recursivo, customização, casos limítrofes
8. [OpenTelemetry](08-opentelemetry.md) — injeção automática de `trace_id`/`span_id`
9. [Log analyzer](09-analyzer.md) — modo local (7 camadas), modo LLM (3 providers)
10. [Performance](10-performance.md) — benchmarks, tuning, hot-path notes
11. [Migration guides](11-migration.md) — vindo de Pino, Winston, structlog, zap
12. [Troubleshooting](12-troubleshooting.md) — sintomas comuns e correções
13. [FAQ](13-faq.md) — perguntas que sempre voltam
14. [API reference](14-api-reference.md) — assinaturas completas por runtime

## Onde encontrar o quê

| Vou fazer… | Vá para |
|---|---|
| Instalar e logar a primeira linha | [Installation](03-installation.md) + quickstart do seu runtime |
| Decidir entre `formatter: datadog` e `elastic` | [Formatters](06-formatters.md) |
| Garantir que `password` nunca vaze | [Redaction](07-redaction.md) |
| Ligar minha telemetria a um span do OTel | [OpenTelemetry](08-opentelemetry.md) |
| Triar logs de erro em produção | [Log analyzer](09-analyzer.md) |
| Sair do Pino sem reescrever a aplicação | [Migration → from Pino](11-migration.md#from-pino) |
| Entender por que `level: 'verbose'` virou `'info'` | [Configuration → log levels](04-configuration.md#log-levels) |
| Garantir que escritas em arquivo não intercalam linhas | [Transports → file ordering](05-transports.md#file-transport) |
| Saber onde a `0 deps` para e o que ela NÃO promete | [Concepts → zero-dependency claim](02-concepts.md#zero-dependency-claim) |
| Reportar bug ou propor feature | [Contributing](../../CONTRIBUTING.md) + [issues](https://github.com/jonathascordeiro20/openinfra-logger/issues) |

## Convenções neste manual

- Trechos em `npm i …`, `pip install …`, `cargo add …`, `go get …` usam os nomes finais publicados nos respectivos registries.
- Diagramas ASCII têm largura ≤ 80 colunas para ler bem em pull requests.
- Quando um comportamento é **exatamente igual em todos os 4 runtimes**, mostro o exemplo em um único runtime e marco a paridade explicitamente. Quando há divergência, mostro todos os runtimes lado a lado.
- "Hot path" significa o código que roda em cada chamada `log()`. "Cold path" é setup, configuração e exit handlers.

## Versões cobertas

- **OpenInfra Logger** — `v0.1.0` (a primeira release pública)
- **Node.js** — ≥ 16, testado em 24
- **Python** — ≥ 3.8, testado em 3.12
- **Go** — ≥ 1.20, testado em 1.26
- **Rust** — ≥ 1.70, testado em 1.95

Versões mais antigas podem funcionar mas não são parte da matriz de CI.
