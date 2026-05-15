/**
 * Example demonstrating OpenInfra Logger automatically extracting
 * trace and span IDs from an active OpenTelemetry context.
 * 
 * Note: To run this, you need @opentelemetry/api installed locally:
 * npm install @opentelemetry/api
 */

const { trace } = require('@opentelemetry/api');
const { log, configure } = require('../src/index');

configure({
  defaultMetadata: { service: 'payment-service' }
});

console.log('--- OpenInfra Logger OpenTelemetry Demo ---\n');

log('Application starting outside of any trace context', 'info');

const tracer = trace.getTracer('demo-tracer');

tracer.startActiveSpan('process-payment', (span) => {
  // This log will automatically pick up the trace_id and span_id
  log('Starting payment processing', 'info', { transactionId: 'txn-999' });

  tracer.startActiveSpan('validate-card', (childSpan) => {
    // This log gets the same trace_id but a different span_id
    log('Card validation successful', 'debug');
    childSpan.end();
  });

  log('Payment processing completed', 'info');
  span.end();
});

console.log('\n--- End of Demonstration ---');
