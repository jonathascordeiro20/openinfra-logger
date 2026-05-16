const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { log, configure, LEVELS } = require('../src/index');

const TMP = path.join(__dirname, 'levels.log');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function readLastEntry(file) {
  const content = fs.readFileSync(file, 'utf8').trim();
  const lastLine = content.split('\n').filter(Boolean).pop();
  return JSON.parse(lastLine);
}

describe('Log Levels', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
    configure({
      transports: ['file'],
      filePath: TMP,
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: []
    });
  });

  afterEach(() => {
    if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  });

  test('numerical level ordering is monotonic', () => {
    assert.ok(LEVELS.debug < LEVELS.info);
    assert.ok(LEVELS.info < LEVELS.warn);
    assert.ok(LEVELS.warn < LEVELS.error);
  });

  test('accepts all four valid levels and writes them as-is', async () => {
    for (const lvl of ['debug', 'info', 'warn', 'error']) {
      log(`msg-${lvl}`, lvl);
      await wait(15);
      const e = readLastEntry(TMP);
      assert.strictEqual(e.level, lvl, `Level ${lvl} should round-trip`);
    }
  });

  test('uppercase level is normalized to lowercase', async () => {
    log('shouted', 'ERROR');
    await wait(30);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.level, 'error');
  });

  test('invalid level falls back to info (regression: normalizedLevel bug)', async () => {
    log('bogus level', 'verbose');
    await wait(30);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.level, 'info', 'Invalid level must be replaced with info in the emitted JSON');
  });

  test('defaults to info when level omitted', async () => {
    log('default level only');
    await wait(30);
    const e = readLastEntry(TMP);
    assert.strictEqual(e.level, 'info');
  });
});
