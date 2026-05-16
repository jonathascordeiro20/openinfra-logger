# 07 · Auto-redaction

[← back to manual index](README.md)

Auto-redaction intercepts sensitive values **inside the process**, before any transport. It's the most load-bearing feature of OIL for any application subject to LGPD or GDPR.

## How it works

Recursive algorithm:

```python
def redact(value, keys_to_redact):
    if value is dict:
        return { k: ("[REDACTED]" if k.lower() in keys_to_redact else redact(v, keys_to_redact))
                 for k, v in value.items() }
    if value is list:
        return [ redact(item, keys_to_redact) for item in value ]
    return value  # primitives are returned as-is
```

The function runs **over the whole entry** after the formatter and before `JSON.stringify`. Approximate cost: ~95 µs/call on Node with a typical payload (4 redactable keys + nested).

## Defaults

```
password
token
secret
api_key
credit_card
```

(case-insensitive on the key — `PASSWORD`, `Password`, `password` all match)

## Customizing

```js
configure({
  redactKeys: [
    // defaults
    'password', 'token', 'secret', 'api_key', 'credit_card',
    // common Brazil
    'cpf', 'rg', 'cnpj',
    // common SaaS
    'ssn', 'phone', 'email', 'address',
    'birthdate', 'mother_name',
    // domain-specific
    'pix_key', 'iban', 'pin_code',
  ],
});
```

**Heads up:** this **replaces** the default array, it doesn't extend it. If you pass `['cpf']`, `password` stops being redacted. Always include the defaults if you still want them.

## What redaction **does**

✓ Replaces the **value** with `[REDACTED]` when the **key** matches.
✓ Recursive in dicts/objects and arrays/lists.
✓ Case-insensitive on key names.
✓ Runs across **all** transports (console, file, remote).
✓ Runs across **all** formatters.
✓ Operates on `defaultMetadata`, the call's `metadata`, and `trace_id`/`span_id` — any key at top level or nested.

## What redaction **does not** do

✗ **Does not detect values without a field name.** If you log a free string like `log("user typed: 4111-1111-1111-1111", "info")`, the card **leaks**. Redaction operates on keys, not values.

✗ **Does not partial-substitute.** When it matches, it replaces with `[REDACTED]` in full. It does not preserve the last 4 digits of a card, the domain of an email, etc.

✗ **Does not detect cognates.** `passwd`, `pwd`, `pass` are not redacted unless you add them. Only `password` by default.

✗ **Does not pattern-match values.** A regex like `\d{16}` (card number) is not detected.

✗ **Does not run in the background** — it's on the hot path. Every `log()` pays the cost. That's why the list should be short enough to stay trivial O(N).

## Edge cases

### Case 1: Mixed-case key

```js
log('login', 'info', {
  Password: 'a',     // → [REDACTED] (case-insensitive)
  TOKEN: 'b',        // → [REDACTED]
  Api_Key: 'c',      // → [REDACTED]
  My_Custom: 'd',    // → "d" (not in the list)
});
```

### Case 2: 5+ levels of nesting

```js
log('deep', 'info', {
  a: { b: { c: { d: { e: { secret: 'leak' } } } } }
});
// → "a":{"b":{"c":{"d":{"e":{"secret":"[REDACTED]"}}}}}
```

Recursion has no max depth. Stack overflow would be possible with circular objects — **but circulars break `JSON.stringify` first**, so OIL doesn't need to guard against them.

### Case 3: Array of objects

```js
log('batch', 'info', {
  items: [
    { token: 'a' },         // → "token":"[REDACTED]"
    { token: 'b' },         // → "token":"[REDACTED]"
    { ok: true },           // → "ok":true (untouched)
  ]
});
```

### Case 4: Null / undefined

```js
log('nulls', 'info', { a: null, password: null });
// → "a":null,"password":"[REDACTED]"
```

The key matched — becomes `[REDACTED]`, even though the original value was `null`. This is intentional: we don't want to leak the **presence** of the field (the fact that there *is* a `password` key is information by itself).

### Case 5: Value is an object, key matches

```js
log('payment', 'info', {
  credit_card: { number: '4111-1111-1111-1111', cvv: '123', exp: '12/26' }
});
// → "credit_card":"[REDACTED]"
```

The entire object becomes `[REDACTED]` (the string). Recursion **stops** when the key matches — it doesn't descend further. Implication: everything inside is protected, but you lose the structure.

### Case 6: Unexpected value type

```js
log('weird', 'info', { token: Buffer.from([1,2,3]) });
// → "token":"[REDACTED]"
```

Even if the value isn't a string or plain object, the key matches → becomes `[REDACTED]`. Buffers, Symbols, Dates, BigInts — all become `[REDACTED]` when the key matches.

## Anti-leak patterns in your application

Even with OIL, some angles depend on **your** code:

### 1. Don't put sensitive strings in `message`

```js
// ✗ leaks
log(`User ${user.email} failed login with password "${user.password}"`, 'warn');

// ✓ protected
log('login failed', 'warn', { user_email: user.email, password: user.password });
```

The message is free text. **OIL does not redact `message`.** Put anything sensitive in metadata.

### 2. Rename your structures to redactable names

```js
// ✗ leaks — "cc" is not in the default list
log('purchase', 'info', { user_id: 123, cc: user.credit_card });

// ✓ protected — rename to "credit_card"
log('purchase', 'info', { user_id: 123, credit_card: user.credit_card });
```

Or add `'cc'` to `redactKeys`. Standardizing names is better.

### 3. HTTP headers are a trap

```js
log('outbound request', 'info', {
  url: '...',
  headers: { Authorization: 'Bearer …' } // ← "Authorization" not in default list
});
```

Fix:

```js
configure({
  redactKeys: ['password','token','secret','api_key','credit_card','authorization','cookie'],
});
```

### 4. Stack traces can contain values

```js
try { /* ... */ } catch (e) {
  log('failed', 'error', { error: e.stack }); // ← if the function had args with values, they may be there
}
```

OIL cannot redact free text inside a string. If you log `e.stack`, read it first and remove what matters explicitly.

## Testing that redaction works

Write a test that logs a payload with `password` and verifies the output:

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

The official OIL suite does exactly this for the 5 default keys + recursive case + array case. See `test/redaction.test.js`.

## Next

→ [08 · OpenTelemetry](08-opentelemetry.md) — automatic `trace_id`/`span_id` injection.
