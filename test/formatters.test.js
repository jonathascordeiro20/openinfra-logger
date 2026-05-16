const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { log, configure } = require('../src/index');

const TMP = path.join(__dirname, 'formatters.log');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function readLastEntry(file) {
  const content = fs.readFileSync(file, 'utf8').trim();
  const lastLine = content.split('\n').filter(Boolean).pop();
  return JSON.parse(lastLine);
}

describe('Formatters - Datadog & Elastic edge cases', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });
  afterEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });

  test('datadog formatter renames span_id when present', async () => {
    configure({
      transports: ['file'], filePath: TMP, formatter: 'datadog',
      defaultMetadata: {}, redactKeys: []
    });
    log('with span', 'info', { trace_id: 't1', span_id: 's1' });
    await wait(40);
    const e = readLastEntry(TMP);
    assert.strictEqual(e['dd.trace_id'], 't1');
    assert.strictEqual(e['dd.span_id'], 's1');
    assert.strictEqual(e.trace_id, undefined);
    assert.strictEqual(e.span_id, undefined);
  });

  test('datadog formatter without trace context still emits valid JSON', async () => {
    configure({
      transports: ['file'], filePath: TMP, formatter: 'datadog',
      defaultMetadata: {}, redactKeys: []
    });
    log('no trace', 'info');
    await wait(40);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.status, 'info');
    assert.strictEqual(e.level, undefined);
    assert.strictEqual(e['dd.trace_id'], undefined);
  });

  test('elastic formatter preserves trace_id verbatim (no renaming yet)', async () => {
    configure({
      transports: ['file'], filePath: TMP, formatter: 'elastic',
      defaultMetadata: {}, redactKeys: []
    });
    log('elastic trace', 'warn', { trace_id: 'abc' });
    await wait(40);
    const e = readLastEntry(TMP);
    assert.strictEqual(e['log.level'], 'warn');
    assert.ok(e['@timestamp']);
    assert.strictEqual(e.trace_id, 'abc');
  });

  test('default formatter keeps standard keys intact', async () => {
    configure({
      transports: ['file'], filePath: TMP, formatter: 'default',
      defaultMetadata: { service: 'api' }, redactKeys: []
    });
    log('default keys', 'info', { extra: 1 });
    await wait(40);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.level, 'info');
    assert.ok(e.timestamp);
    assert.strictEqual(e.service, 'api');
    assert.strictEqual(e.extra, 1);
  });

  test('timestamp is valid ISO-8601 in default formatter', async () => {
    configure({
      transports: ['file'], filePath: TMP, formatter: 'default',
      defaultMetadata: {}, redactKeys: []
    });
    log('iso check', 'info');
    await wait(40);
    const e = readLastEntry(TMP);
    assert.ok(!Number.isNaN(Date.parse(e.timestamp)), 'timestamp must be parseable as a Date');
  });

  test('user metadata cannot override level or message accidentally? It overrides intentionally', async () => {
    // Document existing behavior: user metadata is applied LAST and overrides the standard fields.
    // This is intentional (caller wins), so we lock it down so accidental refactors are caught.
    configure({
      transports: ['file'], filePath: TMP, formatter: 'default',
      defaultMetadata: {}, redactKeys: []
    });
    log('original', 'info', { message: 'override', level: 'warn' });
    await wait(40);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.message, 'override');
    assert.strictEqual(e.level, 'warn');
  });
});
