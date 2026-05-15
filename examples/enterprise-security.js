/**
 * Enterprise Security & Performance Demonstration
 * 
 * Shows two major enterprise features:
 * 1. Auto-Redaction: Passwords and tokens are scrubbed automatically.
 * 2. Remote Batching: Logs are sent in arrays of 100 or every 2 seconds.
 */

const { configure, log } = require('../src/index');

configure({
  transports: ['console', 'remote'], // Remote transport activated
  remoteUrl: 'http://localhost:9999/dummy-endpoint', // Imagine this is Datadog
  batchSize: 5, // Forcing a small batch size for the demo
  flushIntervalMs: 2000,
  defaultMetadata: { service: 'payment-gateway' }
});

console.log('--- Enterprise Security Demo ---');
console.log('Notice how sensitive keys are automatically replaced with [REDACTED]\n');

log('User registration attempt', 'info', {
  username: 'jonathas',
  password: 'super-secret-password-123', // This will be redacted!
  paymentInfo: {
    credit_card: '4532 1111 2222 3333', // This will be redacted!
    currency: 'USD'
  }
});

log('API Call received', 'debug', {
  endpoint: '/api/v1/charge',
  API_KEY: 'sk_live_123456789' // Case-insensitive! This will be redacted!
});

console.log('\n(Since Remote Transport is on, check your network tab if running in a real environment to see logs being sent in batches!)');
console.log('--- End of Demonstration ---');
