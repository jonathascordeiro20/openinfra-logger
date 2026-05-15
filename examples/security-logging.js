const { log, configure } = require('../src/index.js');

// In a security context, we might want an immutable file audit trail
configure({
  transports: ['console', 'file'],
  filePath: './security-audit.log',
  defaultMetadata: { securityDomain: 'authentication' }
});

console.log('--- Security Audit Logging Demonstration ---\n');

function attemptLogin(username, password) {
  log('Login attempt initiated', 'info', { username });

  if (password !== 'SuperSecret123!') {
    // Security violation logging
    log('Authentication failed: Invalid credentials', 'warn', {
      event: 'AUTH_FAILURE',
      username,
      ip: '192.168.1.105',
      actionRequired: 'Monitor for brute-force attacks'
    });
    return false;
  }

  log('Authentication successful', 'info', { 
    event: 'AUTH_SUCCESS', 
    username 
  });
  return true;
}

attemptLogin('admin', 'wrongpassword');
attemptLogin('admin', 'SuperSecret123!');

console.log('\n--- Check security-audit.log file for the trail ---');
