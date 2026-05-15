const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { log, configure, LEVELS } = require('../src/index');

describe('OpenInfra Logger - Node.js Core Tests', () => {
  test('Validates log levels', () => {
    assert.strictEqual(LEVELS.debug, 10);
    assert.strictEqual(LEVELS.info, 20);
    assert.strictEqual(LEVELS.warn, 30);
    assert.strictEqual(LEVELS.error, 40);
  });

  test('Writes to file transport correctly with default formatter', async () => {
    const testLogFile = path.join(__dirname, 'test.log');
    
    if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);

    configure({
      transports: ['file'],
      filePath: testLogFile,
      formatter: 'default',
      defaultMetadata: { env: 'test' }
    });

    log('File test message', 'info', { testId: 123 });

    await new Promise(r => setTimeout(r, 50)); // allow async write

    assert.ok(fs.existsSync(testLogFile), 'Log file should be created');
    
    const content = fs.readFileSync(testLogFile, 'utf8').trim();
    const parsed = JSON.parse(content);

    assert.strictEqual(parsed.message, 'File test message');
    assert.strictEqual(parsed.level, 'info');
    assert.strictEqual(parsed.env, 'test');
    assert.strictEqual(parsed.testId, 123);
    assert.ok(parsed.timestamp, 'Timestamp should exist');

    fs.unlinkSync(testLogFile);
  });

  test('Datadog formatter applies correctly', async () => {
    const testLogFile = path.join(__dirname, 'dd-test.log');
    if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);

    configure({
      transports: ['file'],
      filePath: testLogFile,
      formatter: 'datadog'
    });

    log('Datadog test message', 'warn', { trace_id: 'abc-123' });

    await new Promise(r => setTimeout(r, 50));
    
    const content = fs.readFileSync(testLogFile, 'utf8').trim();
    const parsed = JSON.parse(content);

    assert.strictEqual(parsed.status, 'warn', 'Level should be mapped to status');
    assert.strictEqual(parsed.level, undefined, 'Level should be removed');
    assert.strictEqual(parsed['dd.trace_id'], 'abc-123', 'trace_id should be mapped to dd.trace_id');
    assert.strictEqual(parsed.trace_id, undefined, 'trace_id should be removed');

    fs.unlinkSync(testLogFile);
  });

  test('Elastic formatter applies correctly', async () => {
    const testLogFile = path.join(__dirname, 'elastic-test.log');
    if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);

    configure({
      transports: ['file'],
      filePath: testLogFile,
      formatter: 'elastic'
    });

    log('Elastic test message', 'error');

    await new Promise(r => setTimeout(r, 50));
    
    const content = fs.readFileSync(testLogFile, 'utf8').trim();
    const parsed = JSON.parse(content);

    assert.strictEqual(parsed['log.level'], 'error', 'Level should be mapped to log.level');
    assert.strictEqual(parsed.level, undefined, 'Level should be removed');
    assert.ok(parsed['@timestamp'], 'timestamp should be mapped to @timestamp');
    assert.strictEqual(parsed.timestamp, undefined, 'timestamp should be removed');

    fs.unlinkSync(testLogFile);
  });
});
