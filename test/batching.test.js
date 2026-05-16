const { test, describe, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { log, configure } = require('../src/index');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Minimal HTTP server that captures all received batches
function startCaptureServer() {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { received.push(JSON.parse(body)); } catch { received.push(body); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, received });
    });
  });
}

describe('Remote Batched Transport', () => {
  let server, port, received;

  before(async () => {
    ({ server, port, received } = await startCaptureServer());
  });

  after(() => new Promise(r => server.close(r)));

  beforeEach(() => {
    received.length = 0;
  });

  test('flushes a full batch immediately when batchSize is reached', async () => {
    configure({
      transports: ['remote'],
      remoteUrl: `http://127.0.0.1:${port}/ingest`,
      batchSize: 5,
      flushIntervalMs: 5000, // long, to prove the size trigger
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: []
    });

    for (let i = 0; i < 5; i++) log(`size-${i}`, 'info', { i });
    // wait for HTTP round-trip
    await wait(150);

    assert.strictEqual(received.length, 1, 'Exactly one batch should be sent');
    assert.strictEqual(received[0].length, 5);
    assert.strictEqual(received[0][0].message, 'size-0');
    assert.strictEqual(received[0][4].message, 'size-4');
  });

  test('flushes a partial batch after flushIntervalMs', async () => {
    configure({
      transports: ['remote'],
      remoteUrl: `http://127.0.0.1:${port}/ingest`,
      batchSize: 100, // intentionally larger than what we'll log
      flushIntervalMs: 80,
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: []
    });

    log('time-0', 'info');
    log('time-1', 'info');
    log('time-2', 'info');

    await wait(250); // > flushInterval + HTTP RTT
    assert.strictEqual(received.length, 1, 'Exactly one batch after timer fires');
    assert.strictEqual(received[0].length, 3);
  });

  test('redaction applies before sending remotely', async () => {
    configure({
      transports: ['remote'],
      remoteUrl: `http://127.0.0.1:${port}/ingest`,
      batchSize: 1,
      flushIntervalMs: 5000,
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: ['password']
    });

    log('login', 'info', { password: 'should-not-leak' });
    await wait(120);

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0][0].password, '[REDACTED]');
  });

  test('survives remote endpoint failure without crashing', async () => {
    configure({
      transports: ['remote'],
      remoteUrl: 'http://127.0.0.1:1/no-such-port', // refused
      batchSize: 1,
      flushIntervalMs: 5000,
      formatter: 'default',
      defaultMetadata: {},
      redactKeys: []
    });

    // Should not throw synchronously, and the .catch in flushRemote handles async errors
    assert.doesNotThrow(() => log('will-fail', 'info'));
    await wait(120); // give the rejection time to settle
  });
});
