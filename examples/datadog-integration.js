/**
 * Example demonstrating how to use the 'datadog' formatter.
 * Datadog APM tracing requires specific JSON keys like 'dd.trace_id' and 'status'
 * instead of the standard 'trace_id' and 'level'.
 */

const { trace } = require('@opentelemetry/api');
const { log, configure } = require('../src/index');

// Enable the datadog formatter
configure({
  formatter: 'datadog',
  defaultMetadata: { service: 'auth-api', env: 'production' }
});

console.log('--- Datadog Formatter Demo ---\n');

const tracer = trace.getTracer('datadog-demo');

tracer.startActiveSpan('login-request', (span) => {
  
  // This log will output: "status": "info" and "dd.trace_id": "..."
  log('User attempting to login', 'info', { userId: '123' });

  // This log will output: "status": "error", "dd.trace_id": "..."
  log('Database connection timeout', 'error', { code: 'TIMEOUT' });

  span.end();
});

console.log('\n--- End of Demonstration ---');
