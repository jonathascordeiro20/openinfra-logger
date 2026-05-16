const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { log, configure } = require('../src/index');

const TMP = path.join(__dirname, 'transports.log');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

describe('Transports & Concurrency', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });
  afterEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });

  test('writes nothing when transports list is empty', async () => {
    configure({ transports: [], filePath: TMP, defaultMetadata: {}, redactKeys: [] });
    log('silent', 'info');
    await wait(40);
    assert.strictEqual(fs.existsSync(TMP), false);
  });

  test('multiple sequential writes append (do not overwrite)', async () => {
    configure({ transports: ['file'], filePath: TMP, formatter: 'default', defaultMetadata: {}, redactKeys: [] });
    log('one', 'info');
    log('two', 'info');
    log('three', 'info');
    await wait(80);
    const lines = fs.readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 3);
    const messages = lines.map(l => JSON.parse(l).message);
    assert.deepStrictEqual(messages, ['one', 'two', 'three']);
  });

  test('every emitted line is valid JSON under bursty writes', async () => {
    configure({ transports: ['file'], filePath: TMP, formatter: 'default', defaultMetadata: {}, redactKeys: [] });
    const N = 200;
    for (let i = 0; i < N; i++) log(`burst-${i}`, 'info', { i });
    await wait(300);
    const lines = fs.readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    assert.strictEqual(lines.length, N);
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `Line is not valid JSON: ${line}`);
    }
  });

  test('special characters are properly JSON-escaped (quotes, newlines, unicode)', async () => {
    configure({ transports: ['file'], filePath: TMP, formatter: 'default', defaultMetadata: {}, redactKeys: [] });
    log('quotes: "hi" \\ newline\nhere\ttab 🚀 中文', 'info', { k: 'with "quotes"' });
    await wait(50);
    const lines = fs.readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.ok(parsed.message.includes('"hi"'));
    assert.ok(parsed.message.includes('\n'));
    assert.ok(parsed.message.includes('🚀'));
    assert.strictEqual(parsed.k, 'with "quotes"');
  });

  test('combining file + console transports does not throw', async () => {
    configure({
      transports: ['console', 'file'], filePath: TMP, formatter: 'default',
      defaultMetadata: {}, redactKeys: []
    });
    // Swallow console output by stubbing
    const origLog = console.log;
    const origError = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      assert.doesNotThrow(() => log('multi transport', 'info'));
      assert.doesNotThrow(() => log('multi transport err', 'error'));
    } finally {
      console.log = origLog;
      console.error = origError;
    }
    await wait(50);
    const lines = fs.readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 2);
  });
});
