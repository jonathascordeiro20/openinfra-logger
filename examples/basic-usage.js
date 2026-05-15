const { log } = require('../src/index.js');

console.log('--- OpenInfra Logger Demonstration ---\n');

// Basic informational logging
log('Application server started on port 3000', 'info', { port: 3000, env: 'production' });

// Debugging internal state
log('Parsing incoming configuration payload', 'debug', { bytes: 1024 });

// Warning about potential issues
log('Database latency spike detected', 'warn', { latency_ms: 450 });

// Error reporting
log('Failed to connect to Redis cache', 'error', { code: 'ECONNREFUSED', host: 'localhost:6379' });

console.log('\n--- End of Demonstration ---');
