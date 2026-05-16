# 13 · FAQ

[← back to manual index](README.md)

## Por que mais um logger?

Porque nenhum logger existente é **a mesma coisa** em Node, Python, Go e Rust. Pino é ótimo em Node. structlog é ótimo em Python. zap é ótimo em Go. tracing é ótimo em Rust. Mas nenhum dos quatro emite **o mesmo JSON** que os outros três. Em times poliglotas, isso quebra o Datadog correlator no primeiro incident postmortem que envolve mais de uma linguagem.

## Não é mais simples só padronizar com `winston-format-json` ou similar?

Sim, **se você só tem Node**. Não, se você tem Python + Go também — você acabaria escrevendo três formatters customizados que vão divergir em 18 meses. OIL é a infra que escreve esses três formatters uma vez, audita uma vez, e atualiza uma vez.

## "Zero dependencies" é marketing?

Não é marketing — é literal nos pacotes publicados. Mas é uma claim **sobre a árvore de dependências**, não sobre comportamento de rede. Detalhes em [Concepts → zero-dependency claim](02-concepts.md#zero-dependency-claim).

## A redação é segura?

A redação **previne vazamento em metadata.value quando metadata.key bate**. Ela não detecta valores sensíveis em texto livre (mensagem, stack trace), não faz mascaramento parcial (last-4-digits), e não corre regex em values. Detalhes e armadilhas em [07 · Redaction → padrões anti-vazamento](07-redaction.md#padrões-anti-vazamento-na-sua-aplicação).

## Por que `level: 'verbose'` virou `info`?

Os 4 níveis são intencionalmente restritos (`debug`/`info`/`warn`/`error`). Permitir níveis arbitrários quebra a uniformidade entre runtimes e força filtros customizados em cada backend. Se você precisa de mais granularidade, use o `metadata.category` ou `metadata.severity_detail`.

## OIL tem rotação de arquivo?

Não. Use `logrotate` (Linux), `multilog` (daemontools), ou um shipper (Vector / fluent-bit) que rotacione a montante. Rotação dentro do logger é uma fonte clássica de race conditions e prefere-se fora do processo.

## OIL tem retry de envio remoto?

Não em v0.1.0. Falha de POST é log-and-discard. Se você precisa de garantia de entrega, ponha um shipper local no caminho. **Loggers não devem ser fila de mensagens.**

## Posso usar OIL com `pretty-printer`?

Sim — OIL emite JSON em linhas, então qualquer pretty-printer aceita. Em dev:

```bash
node app.js | jq .
node app.js | pino-pretty
python app.py | jq .
```

## Em produção, devo usar `console` ou `file`?

**`console`** se você tem qualquer um destes:
- Docker + log driver (`json-file`, `journald`)
- Kubernetes (kubelet coleta stdout/stderr)
- Datadog Agent, Vector, fluent-bit no host

**`file`** se você tem:
- Compliance que exige logs em disco
- Sem agente de coleta no host
- Quer fallback para quando o backend cai

`remote` se você está em serverless ou edge sem agente local.

## OIL afeta a performance do meu app?

No Node, ~99 µs de p50 por `log()`. Em uma API REST típica (1k QPS, 5 logs por request), isso é ~5% da capacidade da CPU dedicada a uma core. Geralmente não detectável fora de profiling intencional. Se você está no limite de CPU, `redactKeys: []` corta o gargalo dominante.

## Por que o Rust está com features tão reduzidas?

A v0.1 do Rust é proposital — um JSON builder zero-dep que é trivialmente auditável (~100 linhas no `lib.rs`). Adicionar formatters, redaction recursive e batch transport sem trazer crate é trabalho real e bem testado, e veio para v0.2.

## Posso contribuir?

Sim. Veja [CONTRIBUTING.md](../../CONTRIBUTING.md). O princípio mais importante: **paridade entre runtimes**. Se você adicionar uma feature em um runtime, considere o que ela vira nos outros três.

## Quem mantém isso?

Jonathas Cordeiro (<https://github.com/jonathascordeiro20>). Solo no momento. Open to maintainers — especialmente alguém Go ou Rust fluente que queira owner do roadmap dessas linguagens.

## Posso usar comercialmente?

MIT. Sim — sem royalty, sem aviso, sem obrigação de contribuir. Não recomendamos fork sem fechar comunicação primeiro (issue, e-mail), mas é totalmente seu direito.

## Onde reportar vulnerabilidade de segurança?

NÃO use issues públicas para vulnerabilidades. E-mail direto: <jonathas.cordeiro2023@gmail.com> com assunto `[security] openinfra-logger`. Resposta em até 48h úteis.

## E se eu quiser apenas o JSON shape sem usar a lib?

Use. O contrato está em [02 · Concepts](02-concepts.md#o-contrato-json). Não é proprietário; documente sua interpretação dele no seu repo e voilá. A lib é uma implementação de referência, não a única.

## Vai ter v1.0?

Quando: as APIs estabilizarem a ponto de podermos commitar com semver estrita. Quando: Rust e Go tiverem paridade com Node e Python (formatters, batching, redaction, OTel). Estimativa atual: **6–9 meses**, mas depende de adoção e feedback.

## Próximo passo

→ [14 · API reference](14-api-reference.md) — assinaturas completas por runtime.
