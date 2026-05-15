# Integration Guide

OpenInfra Logger is designed to be easily integrated into any modern application framework.

## Express.js Middleware
You can use OpenInfra Logger to automatically trace HTTP requests and responses in your Express applications.

```javascript
const { log } = require('openinfra-logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('HTTP Request Processed', 'info', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip
    });
  });
  
  next();
}

app.use(requestLogger);
```
See the full working code in `examples/express-integration.js`.
