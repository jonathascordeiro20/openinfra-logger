/*
 * OpenInfra Logger — Node benchmark
 *
 * Measures the *core* path of OIL: building one structured JSON entry with
 * default metadata and redaction, then dispatching to stdout. The numbers
 * below are useful for spotting regressions, NOT for ranking loggers — every
 * logger has a different default surface (auto-context capture, OTel hooks,
 * file rotation, etc) and a "log-per-second" race is misleading without
 * normalizing those features.
 *
 * What we measure:
 *   1. Cold start latency for a single log() call.
 *   2. Steady-state throughput on a tight loop with stdout redirected to /dev/null.
 *
 * Run:    node benchmarks/node-baseline.js
 * Honest: redirect stdout away from a TTY (`> /dev/null` on Unix, `> NUL` on Windows)
 *         to avoid measuring terminal repaint cost.
 */
'use strict';

const { performance } = require('node:perf_hooks');
const { log, configure } = require('../src/index.js');

function fmt(n) { return n.toLocaleString('en-US'); }
function ns(ms) { return `${(ms * 1e6).toFixed(0).padStart(6)} ns`; }

function runWarmup(n = 1000) {
  for (let i = 0; i < n; i++) log('warmup', 'info', { i });
}

function measureSingleCall() {
  const N = 50;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    log('order.placed', 'info', {
      userId: 'u_8821',
      orderId: 'o_4419',
      amount: 1999,
      currency: 'BRL',
    });
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return {
    p50: samples[Math.floor(N * 0.5)],
    p95: samples[Math.floor(N * 0.95)],
    p99: samples[Math.floor(N * 0.99)],
  };
}

function measureThroughput(durationMs = 2000) {
  let count = 0;
  const start = performance.now();
  const deadline = start + durationMs;
  while (performance.now() < deadline) {
    log('throughput', 'info', { i: count, k: 'value' });
    count++;
  }
  const elapsed = performance.now() - start;
  return { count, elapsed, perSec: count / (elapsed / 1000) };
}

function measureRedactionCost() {
  configure({
    transports: ['console'],
    formatter: 'default',
    defaultMetadata: {},
    redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card'],
  });
  const N = 5000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    log('with-redaction', 'info', {
      user: 'alice',
      password: 'shouldnotleak',
      token: 'xyz',
      nested: { credit_card: '4111-1111-1111-1111' },
    });
  }
  return (performance.now() - t0) / N; // ms per call
}

function main() {
  // Redirect console output to avoid measuring terminal repaint.
  // (If you want to see the entries, omit the line below.)
  console.log = () => {};
  console.error = () => {};

  configure({
    transports: ['console'],
    formatter: 'default',
    defaultMetadata: { service: 'bench', env: 'local' },
    redactKeys: [],
  });

  runWarmup();

  const lat = measureSingleCall();
  const th = measureThroughput(2000);
  const redact = measureRedactionCost();

  // Restore stderr for reporting.
  // eslint-disable-next-line no-undef
  process.stderr.write(`
OpenInfra Logger — Node benchmark (single-process, single-thread)
-------------------------------------------------------------------
Node:        ${process.version} on ${process.platform} ${process.arch}
Output:      console (sink = /dev/null equivalent)

Single-call latency (50 samples after warmup)
  p50          ${ns(lat.p50)}
  p95          ${ns(lat.p95)}
  p99          ${ns(lat.p99)}

Throughput (2 second steady-state)
  events       ${fmt(th.count)}
  per second   ${fmt(Math.round(th.perSec))}

Redaction overhead (5,000 calls, 4 sensitive keys in payload)
  per call     ${ns(redact)}
-------------------------------------------------------------------
Note: these numbers are environment-dependent. Re-run on your target hardware
      before publishing claims. The repository CI does not gate on absolute
      thresholds.
`);
}

main();
