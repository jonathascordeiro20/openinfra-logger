const express = require('express');
const { log, configure } = require('../src/index.js');

// Configure default metadata for this service
configure({
  defaultMetadata: { service: 'api-gateway' }
});

const app = express();
const PORT = 3000;

// Middleware to log all incoming requests
app.use((req, res, next) => {
  const start = Date.now();
  
  // Wait for the response to finish to capture the status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('Incoming HTTP Request', 'info', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration_ms: duration,
      userAgent: req.headers['user-agent']
    });
  });
  
  next();
});

app.get('/', (req, res) => {
  log('Handling root endpoint', 'debug');
  res.send('OpenInfra Logger Express Example');
});

app.get('/error', (req, res) => {
  log('Simulating an internal server error', 'error', { endpoint: '/error' });
  res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
  log(`Express server started and listening on port ${PORT}`, 'info');
});

// Note: To run this example, ensure you have express installed:
// npm install express
