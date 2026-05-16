# 07 · Auto-redaction

[← back to manual index](README.md)

A redação automática intercepta valores sensíveis **dentro do processo**, antes de qualquer transport. É a feature mais load-bearing do OIL para qualquer aplicação sujeita a LGPD ou GDPR.

## Como funciona

Algoritmo recursivo:

```python
def redact(value, keys_to_redact):
    if value is dict:
        return { k: ("[REDACTED]" if k.lower() in keys_to_redact else redact(v, keys_to_redact))
                 for k, v in value.items() }
    if value is list:
        return [ redact(item, keys_to_redact) for item in value ]
    return value  # primitives are returned as-is
```

A função roda **sobre a entry inteira** depois do formatter e antes do `JSON.stringify`. Custo aproximado: ~95µs/call no Node sob payload típico (4 chaves redatáveis + nested).

## Defaults

```
password
token
secret
api_key
credit_card
```

(case-insensitive na key — `PASSWORD`, `Password`, `password` todos são redatados)

## Customizando

```js
configure({
  redactKeys: [
    // defaults
    'password', 'token', 'secret', 'api_key', 'credit_card',
    // adicionais comuns para BR
    'cpf', 'rg', 'cnpj',
    // adicionais comuns para SaaS
    'ssn', 'phone', 'email', 'address',
    'birthdate', 'mother_name',
    // específicos do seu domínio
    'pix_key', 'iban', 'pin_code',
  ],
});
```

**Atenção:** isso **substitui** o array default, não adiciona. Se você passar `['cpf']`, o `password` deixa de ser redatado. Sempre inclua os defaults se ainda os quer.

## O que a redação **faz**

✓ Substitui o **valor** por `[REDACTED]` quando a **key** bate.
✓ Recursiva em dicts/objects e arrays/lists.
✓ Case-insensitive em key names.
✓ Roda em **todos** os transports (console, file, remote).
✓ Roda em **todos** os formatters.
✓ Funciona sobre `defaultMetadata`, `metadata` da chamada, e `trace_id`/`span_id` — qualquer key no top-level ou nested.

## O que a redação **não** faz

✗ **Não detecta valores sem nome de campo.** Se você loga uma string solta como `log("user typed: 4111-1111-1111-1111", "info")`, o cartão **vaza**. A redação opera sobre keys, não sobre values.

✗ **Não substitui parcialmente.** Quando matcha, vira `[REDACTED]` por inteiro. Não preserva últimos 4 dígitos do cartão, não preserva domínio do email.

✗ **Não detecta cognatos.** `passwd`, `pwd`, `pass` não são redatados se você não adicionar à lista. Só `password` por default.

✗ **Não faz mascaramento por regex sobre values.** Padrão `\d{16}` (cartão) não é detectado.

✗ **Não corre em background** — é parte do hot path. Cada `log()` paga o custo. Por isso a lista deve ser curta o suficiente para ser O(N) trivial.

## Edge cases

### Caso 1: Key com case misturado

```js
log('login', 'info', {
  Password: 'a',     // → [REDACTED] (case-insensitive)
  TOKEN: 'b',        // → [REDACTED]
  Api_Key: 'c',      // → [REDACTED]
  My_Custom: 'd',    // → "d" (não está na lista)
});
```

### Caso 2: Nested 5+ levels

```js
log('deep', 'info', {
  a: { b: { c: { d: { e: { secret: 'leak' } } } } }
});
// → "a":{"b":{"c":{"d":{"e":{"secret":"[REDACTED]"}}}}}
```

A recursão não tem profundidade máxima. Stack overflow seria possível em objetos circulares — **mas circulares quebram o `JSON.stringify` antes**, então o OIL não precisa se proteger disso.

### Caso 3: Array de objects

```js
log('batch', 'info', {
  items: [
    { token: 'a' },         // → "token":"[REDACTED]"
    { token: 'b' },         // → "token":"[REDACTED]"
    { ok: true },           // → "ok":true (não toca)
  ]
});
```

### Caso 4: Null / undefined

```js
log('nulls', 'info', { a: null, password: null });
// → "a":null,"password":"[REDACTED]"
```

A key matchou — vira `[REDACTED]`, mesmo o valor original sendo `null`. Isso é proposital: não queremos vazar a **presença** do campo (o fato de ter uma key `password` é informação por si).

### Caso 5: Valor é objeto, key matcha

```js
log('payment', 'info', {
  credit_card: { number: '4111-1111-1111-1111', cvv: '123', exp: '12/26' }
});
// → "credit_card":"[REDACTED]"
```

O objeto inteiro vira `[REDACTED]` (a string). A recursão **para** quando a key matcha — não desce mais. Implicação: tudo dentro está protegido, mas você perde a estrutura.

### Caso 6: Valor de tipo inesperado

```js
log('weird', 'info', { token: Buffer.from([1,2,3]) });
// → "token":"[REDACTED]"
```

Mesmo se o valor não é uma string nem um objeto comum, a key bate → vira `[REDACTED]`. Buffers, Symbols, Dates, BigInts — todos viram `[REDACTED]` se a key matcha.

## Padrões anti-vazamento na sua aplicação

Mesmo com OIL, existem ângulos que dependem do **seu** código:

### 1. Não passe strings sensíveis no `message`

```js
// ✗ vaza
log(`User ${user.email} failed login with password "${user.password}"`, 'warn');

// ✓ protegido
log('login failed', 'warn', { user_email: user.email, password: user.password });
```

A mensagem é texto livre. **OIL não redacta o `message`.** Use o metadata para qualquer coisa sensível.

### 2. Renomeie suas estruturas para nomes redatáveis

```js
// ✗ vaza — "cc" não está na lista default
log('purchase', 'info', { user_id: 123, cc: user.credit_card });

// ✓ protegido — renomear para "credit_card"
log('purchase', 'info', { user_id: 123, credit_card: user.credit_card });
```

Ou adicione `'cc'` ao `redactKeys`. Mas é melhor padronizar nomes.

### 3. Headers HTTP são uma armadilha

```js
log('outbound request', 'info', { 
  url: '...', 
  headers: { Authorization: 'Bearer …' } // ← "Authorization" não está na lista default
});
```

Solução:

```js
configure({
  redactKeys: ['password','token','secret','api_key','credit_card','authorization','cookie'],
});
```

### 4. Stack traces podem conter valores

```js
try { /* ... */ } catch (e) {
  log('failed', 'error', { error: e.stack }); // ← se a função tinha args com valores, eles podem estar aqui
}
```

OIL não pode redactar texto livre dentro de uma string. Se você loga `e.stack`, leia antes e remova explicitamente o que importa.

## Testando que a redação funciona

Crie um test que loga um payload com `password` e verifica o output:

```js
const fs = require('fs');
const { log, configure } = require('@jonathascordeiro20/openinfra-logger');

configure({ transports: ['file'], filePath: '/tmp/test.log', redactKeys: ['password'] });
log('test', 'info', { password: 'p@ss', user: 'alice' });

setTimeout(() => {
  const content = fs.readFileSync('/tmp/test.log', 'utf8');
  if (content.includes('p@ss')) throw new Error('LEAKED!');
  console.log('OK — redacted');
}, 50);
```

A suíte oficial do OIL faz exatamente isso para os 5 keys default + caso recursivo + caso array. Veja `test/redaction.test.js`.

## Próximo passo

→ [08 · OpenTelemetry](08-opentelemetry.md) — injeção automática de `trace_id`/`span_id`.
