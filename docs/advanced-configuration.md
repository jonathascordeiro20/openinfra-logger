# Advanced Configuration

The `configure()` method allows you to tailor OpenInfra Logger to your environment's specific needs.

## Transports
Transports dictate where your logs are sent.
- **`console`**: (Default) Outputs to `stdout`/`stderr` using standard Node.js console methods. Best for containerized environments (Docker/Kubernetes).
- **`file`**: Appends JSON strings to a file. Requires `filePath` configuration.
- **`remote`**: Sends HTTP POST requests containing the JSON log. Requires `remoteUrl`.

## Configuration Object
```javascript
const { configure } = require('openinfra-logger');

configure({
  transports: ['console', 'file', 'remote'],
  filePath: '/var/log/app.log', // Required if 'file' transport is used
  remoteUrl: 'https://ingest.datadoghq.com/api/v2/logs', // Required if 'remote' is used
  remoteHeaders: { 'Authorization': 'Bearer YOUR_TOKEN' }, // Optional HTTP headers
  defaultMetadata: { // Attached to EVERY log emitted
    serviceName: 'user-auth-service',
    cluster: 'us-east-1'
  }
});
```
