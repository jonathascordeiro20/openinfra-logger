const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { log, configure } = require('../src/index');

const TMP = path.join(__dirname, 'redaction.log');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function readEntry(file) {
  const content = fs.readFileSync(file, 'utf8').trim();
  const lastLine = content.split('\n').filter(Boolean).pop();
  return JSON.parse(lastLine);
}

describe('Auto-Redaction', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
    configure({
      transports: ['file'],
      filePath: TMP,
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card']
    });
  });

  afterEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });

  test('redacts top-level sensitive keys', async () => {
    log('login attempt', 'info', { user: 'alice', password: 'p@ss', token: 'xyz' });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.password, '[REDACTED]');
    assert.strictEqual(e.token, '[REDACTED]');
    assert.strictEqual(e.user, 'alice');
  });

  test('redacts nested sensitive keys recursively', async () => {
    log('payment', 'info', {
      tx: { amount: 100, credit_card: '4111-1111-1111-1111', meta: { api_key: 'sk_live_X' } }
    });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.tx.credit_card, '[REDACTED]');
    assert.strictEqual(e.tx.meta.api_key, '[REDACTED]');
    assert.strictEqual(e.tx.amount, 100);
  });

  test('redacts inside arrays', async () => {
    log('batch', 'info', { items: [{ token: 'a' }, { token: 'b' }, { ok: true }] });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.items[0].token, '[REDACTED]');
    assert.strictEqual(e.items[1].token, '[REDACTED]');
    assert.strictEqual(e.items[2].ok, true);
  });

  test('redaction is case-insensitive on keys', async () => {
    log('mixed case', 'info', { Password: 'a', TOKEN: 'b', Api_Key: 'c' });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.Password, '[REDACTED]');
    assert.strictEqual(e.TOKEN, '[REDACTED]');
    assert.strictEqual(e.Api_Key, '[REDACTED]');
  });

  test('custom redactKeys override defaults', async () => {
    configure({ redactKeys: ['ssn'] });
    log('custom', 'info', { ssn: '123-45-6789', password: 'kept' });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.ssn, '[REDACTED]');
    assert.strictEqual(e.password, 'kept'); // not in custom list
  });

  test('handles null and undefined metadata values gracefully', async () => {
    log('nulls', 'info', { a: null, b: undefined, password: null });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.a, null);
    assert.strictEqual(e.password, '[REDACTED]');
  });

  test('preserves non-object primitives unchanged', async () => {
    log('primitives', 'info', { n: 42, s: 'hi', b: true, arr: [1, 2, 3] });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.n, 42);
    assert.strictEqual(e.s, 'hi');
    assert.strictEqual(e.b, true);
    assert.deepStrictEqual(e.arr, [1, 2, 3]);
  });

  test('deep nesting (5+ levels) is fully redacted', async () => {
    log('deep', 'info', { a: { b: { c: { d: { e: { secret: 'leak' } } } } } });
    await wait(40);
    const e = readEntry(TMP);
    assert.strictEqual(e.a.b.c.d.e.secret, '[REDACTED]');
  });
});
