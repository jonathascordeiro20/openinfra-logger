#!/usr/bin/env node
/**
 * OpenInfra Logger — log analyzer
 *
 * Default mode is FULLY LOCAL. No network call. Parses the file, clusters
 * errors, applies heuristics for common failure shapes, detects temporal
 * cascades, derives a service dependency graph from trace_id, and flags
 * statistical anomalies.
 *
 * Optional deep-analysis modes (opt-in, you choose where the data goes):
 *   --llm=anthropic   cloud, requires ANTHROPIC_API_KEY
 *   --llm=ollama      local LLM via Ollama (default model: llama3.1)
 *   --llm=openai      OpenAI-compatible endpoint (LM Studio, vLLM, OpenAI)
 *
 * Examples:
 *   npm run analyze app.log
 *   npm run analyze app.log -- --llm=ollama
 *   npm run analyze app.log -- --llm=anthropic
 *   npm run analyze app.log -- --prompt-only
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- arg parsing ----------
const args = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const a of args) {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    flags.set(k, v ?? true);
  } else {
    positional.push(a);
  }
}
const LOG_FILE = positional[0] || 'app.log';
const LLM = flags.get('llm');               // 'anthropic' | 'ollama' | 'openai' | undefined
const PROMPT_ONLY = flags.has('prompt-only');
const HELP = flags.has('help') || flags.has('h');

if (HELP) {
  console.log(`\nOpenInfra Logger — log analyzer\n`);
  console.log(`Usage:`);
  console.log(`  npm run analyze <log-file>                       fully local parse + heuristics`);
  console.log(`  npm run analyze <log-file> -- --llm=anthropic    Claude API (needs ANTHROPIC_API_KEY)`);
  console.log(`  npm run analyze <log-file> -- --llm=ollama       local LLM via Ollama (localhost:11434)`);
  console.log(`  npm run analyze <log-file> -- --llm=openai       OpenAI-compatible endpoint`);
  console.log(`  npm run analyze <log-file> -- --prompt-only      print prompt, no API call\n`);
  console.log(`Env vars (per provider):`);
  console.log(`  ANTHROPIC_API_KEY                                anthropic only`);
  console.log(`  OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL    openai (defaults: api.openai.com, gpt-4o-mini)`);
  console.log(`  OLLAMA_HOST, OLLAMA_MODEL                        ollama (defaults: http://localhost:11434, llama3.1)\n`);
  process.exit(0);
}

console.log(`\n📊 OpenInfra Logger — log analyzer`);
console.log(`==================================\n`);

const fullPath = path.resolve(process.cwd(), LOG_FILE);
if (!fs.existsSync(fullPath)) {
  console.error(`❌ Log file not found: ${fullPath}`);
  console.log(`Usage: npm run analyze <log-file> [-- --llm=anthropic|ollama|openai | --prompt-only]`);
  process.exit(1);
}

const fileContent = fs.readFileSync(fullPath, 'utf8');
const rawLines = fileContent.split('\n').filter(l => l.trim() !== '');

// ---------- parse ----------
const entries = [];
let nonJsonLines = 0;
for (const line of rawLines) {
  try {
    entries.push(JSON.parse(line));
  } catch {
    nonJsonLines++;
  }
}

console.log(`📄 ${LOG_FILE} — ${entries.length} structured entries, ${nonJsonLines} non-JSON lines`);

// Support default, datadog, and elastic formats
function levelOf(e)   { return (e.level || e.status || e['log.level'] || '').toLowerCase(); }
function tsOf(e)      { return e.timestamp || e['@timestamp'] || ''; }
function msgOf(e)     { return e.message || ''; }
function serviceOf(e) { return e.service || e.app || 'unknown'; }
function traceOf(e)   { return e.trace_id || e['dd.trace_id'] || e['trace.id'] || ''; }
function stackOf(e)   { return e.stack || e.stack_trace || e.error?.stack || ''; }

const errors = entries.filter(e => {
  const lvl = levelOf(e);
  return lvl === 'error' || lvl === 'warn';
});

if (errors.length === 0) {
  console.log(`✅ No errors or warnings detected. Systems look healthy.`);
  process.exit(0);
}

console.log(`🔍 ${errors.length} anomaly entries (level=error|warn)\n`);

// ---------- (1) clustering by normalized message ----------
function normalizeForCluster(msg) {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replace(/0x[0-9a-f]+/gi, 'HEX')
    .replace(/\b\d{2,}\b/g, 'N')
    .trim()
    .slice(0, 200);
}

const clusters = new Map();
for (const e of errors) {
  const key = normalizeForCluster(msgOf(e)) || '(no message)';
  const c = clusters.get(key) || { count: 0, samples: [], services: new Set(), levels: new Set(), traces: new Set(), firstTs: null, lastTs: null };
  c.count++;
  if (c.samples.length < 2) c.samples.push(e);
  c.services.add(serviceOf(e));
  c.levels.add(levelOf(e));
  const t = traceOf(e); if (t) c.traces.add(t);
  const ts = tsOf(e);
  if (ts) {
    if (!c.firstTs || ts < c.firstTs) c.firstTs = ts;
    if (!c.lastTs || ts > c.lastTs) c.lastTs = ts;
  }
  clusters.set(key, c);
}

const sortedClusters = [...clusters.entries()].sort((a, b) => b[1].count - a[1].count);
const TOP = Math.min(5, sortedClusters.length);

console.log(`📦 Top error clusters`);
console.log(`─────────────────────`);
for (let i = 0; i < TOP; i++) {
  const [key, c] = sortedClusters[i];
  console.log(`  ${String(c.count).padStart(4)}× [${[...c.levels].join('|')}] ${[...c.services].join(',')}  ·  ${key}`);
}
console.log('');

// ---------- (2) regex heuristics ----------
const HEURISTICS = [
  { name: 'Timeout cascade',  pattern: /timeout|deadline exceeded|ETIMEDOUT|ECONNRESET|context deadline/i,
    hint: 'Check upstream latency, retry budgets, and connection pool sizes. Look for one slow dependency degrading many consumers.' },
  { name: 'Out of memory',    pattern: /out of memory|OOM|heap out|killed|cannot allocate/i,
    hint: 'Check container memory limits, recent payload-size changes, and leak suspects (caches without TTL, accumulating listeners).' },
  { name: 'Database failure', pattern: /deadlock|connection refused|too many connections|constraint|duplicate key|relation .* does not exist/i,
    hint: 'Inspect the DB pool, recent migrations, and whether the failing query lacks an index on the join key.' },
  { name: 'Auth / 401-403',   pattern: /unauthorized|forbidden|invalid token|jwt|expired|401|403/i,
    hint: 'Token rotation, clock skew, or a missing/incorrect audience claim. Check the auth provider status page.' },
  { name: '5xx upstream',     pattern: /5\d\d|bad gateway|service unavailable|internal server error/i,
    hint: 'Aggregate by upstream host. One bad dependency is usually the culprit.' },
  { name: 'Rate limit',       pattern: /429|rate.?limit|too many requests|throttle/i,
    hint: 'Look at the caller distribution — typically one client is misconfigured, not the whole population.' },
];

const flagged = [];
for (const h of HEURISTICS) {
  let total = 0;
  for (const [key, c] of sortedClusters) {
    if (h.pattern.test(key)) total += c.count;
  }
  if (total > 0) flagged.push({ ...h, total });
}

if (flagged.length > 0) {
  console.log(`🩺 Heuristic findings`);
  console.log(`─────────────────────`);
  for (const f of flagged) {
    console.log(`  ${f.total}× ${f.name}`);
    console.log(`    └─ ${f.hint}`);
  }
  console.log('');
}

// ---------- (3) stack trace dedup ----------
const stackClusters = new Map();
for (const e of errors) {
  const s = stackOf(e);
  if (!s) continue;
  // Normalize: top 3 frames, strip line numbers and absolute paths
  const top = s.split('\n').slice(0, 3)
    .map(l => l.replace(/:\d+:\d+|:\d+/g, ':L').replace(/\(.*?node_modules[\\/]/g, '(node_modules/').trim())
    .join(' ↳ ');
  if (!top) continue;
  stackClusters.set(top, (stackClusters.get(top) || 0) + 1);
}
if (stackClusters.size > 0) {
  const topStacks = [...stackClusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`🧱 Top stack traces (top-3 frames, deduped)`);
  console.log(`─────────────────────────────────────────────`);
  for (const [s, n] of topStacks) console.log(`  ${String(n).padStart(4)}× ${s}`);
  console.log('');
}

// ---------- (4) temporal cascade detection ----------
// Errors that arrive in tight bursts (≥3 errors within a 1s window) hint at a cascade.
const tsParsed = errors.map(e => ({ t: Date.parse(tsOf(e)), e })).filter(x => !Number.isNaN(x.t)).sort((a, b) => a.t - b.t);
const cascades = [];
if (tsParsed.length >= 3) {
  let windowStart = 0;
  for (let i = 1; i < tsParsed.length; i++) {
    while (tsParsed[i].t - tsParsed[windowStart].t > 1000) windowStart++;
    const size = i - windowStart + 1;
    if (size >= 3) {
      // Capture the burst and skip ahead so we don't double-count
      const services = new Set(tsParsed.slice(windowStart, i + 1).map(x => serviceOf(x.e)));
      cascades.push({
        from: new Date(tsParsed[windowStart].t).toISOString(),
        to:   new Date(tsParsed[i].t).toISOString(),
        size,
        services: [...services],
      });
      i = i + size;
      windowStart = i;
    }
  }
}
if (cascades.length > 0) {
  console.log(`⚡ Temporal cascades (≥3 errors / 1 s)`);
  console.log(`────────────────────────────────────────`);
  for (const c of cascades.slice(0, 5)) {
    console.log(`  ${c.size}× between ${c.from} → ${c.to}  ·  services: ${c.services.join(', ')}`);
  }
  console.log('');
}

// ---------- (5) anomaly score per minute (z-score) ----------
const buckets = new Map();
for (const { t } of tsParsed) {
  const min = Math.floor(t / 60000);
  buckets.set(min, (buckets.get(min) || 0) + 1);
}
let anomalies = [];
if (buckets.size >= 5) {
  const values = [...buckets.values()];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  for (const [min, n] of buckets.entries()) {
    const z = (n - mean) / std;
    if (z >= 2) anomalies.push({ when: new Date(min * 60000).toISOString(), count: n, z: z.toFixed(2) });
  }
  anomalies.sort((a, b) => b.z - a.z);
  if (anomalies.length > 0) {
    console.log(`📈 Per-minute anomaly windows (z ≥ 2 over baseline ${mean.toFixed(1)} ± ${std.toFixed(1)})`);
    console.log(`────────────────────────────────────────────────────────────────────`);
    for (const a of anomalies.slice(0, 5)) {
      console.log(`  ${a.when}  ·  ${a.count} errors  ·  z=${a.z}`);
    }
    console.log('');
  }
}

// ---------- (6) service dependency graph via trace_id ----------
const traceToServices = new Map();
for (const e of entries) {
  const t = traceOf(e); if (!t) continue;
  const set = traceToServices.get(t) || new Set();
  set.add(serviceOf(e));
  traceToServices.set(t, set);
}
const pairCounts = new Map();
for (const services of traceToServices.values()) {
  const list = [...services];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const k = [list[i], list[j]].sort().join(' ↔ ');
      pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
    }
  }
}
if (pairCounts.size > 0) {
  console.log(`🕸  Service interactions (derived from trace_id)`);
  console.log(`────────────────────────────────────────────────`);
  for (const [pair, n] of [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${String(n).padStart(4)} traces  ·  ${pair}`);
  }
  console.log('');
}

// ---------- (7) service breakdown + time bounds ----------
const byService = new Map();
for (const e of errors) {
  const s = serviceOf(e);
  byService.set(s, (byService.get(s) || 0) + 1);
}
if (byService.size > 1) {
  console.log(`🏷  Errors by service`);
  console.log(`────────────────────`);
  for (const [s, n] of [...byService.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}× ${s}`);
  }
  console.log('');
}
if (tsParsed.length > 0) {
  console.log(`⏱  Window: ${new Date(tsParsed[0].t).toISOString()} → ${new Date(tsParsed[tsParsed.length-1].t).toISOString()}\n`);
}

// ---------- prompt builder (used by --llm and --prompt-only) ----------
function buildPrompt() {
  const summary = sortedClusters.slice(0, 10).map(([key, c]) => ({
    count: c.count,
    levels: [...c.levels],
    services: [...c.services],
    pattern: key,
    sample: c.samples[0],
  }));
  return `You are an expert Site Reliability Engineer (SRE). Analyze the following clustered error logs from a production system.

Identify the most probable root cause, the suspected upstream and downstream impact, and propose 3 concrete remediation steps the on-call engineer can take in the next 30 minutes.

Total errors: ${errors.length}
Heuristic findings: ${flagged.map(f => `${f.name} (${f.total}×)`).join(', ') || 'none'}
Temporal cascades: ${cascades.length}
Anomaly windows: ${anomalies.length}
Service interactions (top 3): ${[...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => `${p} (${n})`).join(' · ') || 'none'}

Top clusters:
${JSON.stringify(summary, null, 2)}`;
}

// ---------- LLM dispatch (opt-in) ----------
if (PROMPT_ONLY) {
  console.log(`📋 Prompt (copy below, paste into your LLM of choice):\n`);
  console.log('--- COPY BELOW ---\n');
  console.log(buildPrompt());
  console.log('\n--- COPY ABOVE ---\n');
  process.exit(0);
}

if (!LLM) {
  console.log(`💡 Local analysis complete. For an LLM-deepened narrative, opt in:`);
  console.log(`   npm run analyze ${LOG_FILE} -- --llm=anthropic   (cloud, ANTHROPIC_API_KEY)`);
  console.log(`   npm run analyze ${LOG_FILE} -- --llm=ollama      (local Ollama)`);
  console.log(`   npm run analyze ${LOG_FILE} -- --llm=openai      (OpenAI-compatible endpoint)`);
  console.log(`   npm run analyze ${LOG_FILE} -- --prompt-only     (print prompt, no API call)\n`);
  process.exit(0);
}

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

async function callOllama(prompt) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.1';
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}. Is ${host} reachable? Is "${model}" pulled?`);
  const data = await res.json();
  return data.message?.content ?? JSON.stringify(data);
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!key && /api\.openai\.com/.test(base)) throw new Error('OPENAI_API_KEY is not set');
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

(async () => {
  console.log(`🤖 Calling LLM provider: ${LLM}\n`);
  let answer;
  try {
    if (LLM === 'anthropic')   answer = await callAnthropic(buildPrompt());
    else if (LLM === 'ollama') answer = await callOllama(buildPrompt());
    else if (LLM === 'openai') answer = await callOpenAI(buildPrompt());
    else { console.error(`Unknown --llm value: ${LLM}. Use anthropic | ollama | openai.`); process.exit(2); }
  } catch (e) {
    console.error(`❌ LLM call failed: ${e.message}`);
    process.exit(1);
  }
  console.log(`💡 Deep analysis\n────────────────\n`);
  console.log(answer);
  console.log('');
})();
