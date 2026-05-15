/**
 * OpenInfra Logger
 * Critical infrastructure library for structured observability.
 */
const fs = require('fs');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Default configuration
let config = {
  transports: ['console'], // console, file, remote
  filePath: './app.log',
  remoteUrl: null,
  remoteHeaders: { 'Content-Type': 'application/json' },
  defaultMetadata: {}
};

/**
 * Configure the logger transports and defaults.
 * @param {object} newConfig - Configuration overrides
 */
function configure(newConfig = {}) {
  config = { ...config, ...newConfig };
}

/**
 * Attempt to extract trace context if OpenTelemetry is active.
 * Zero-dependency check.
 */
function extractTraceContext() {
  try {
    const opentelemetry = require('@opentelemetry/api');
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      if (opentelemetry.trace.isSpanContextValid(spanContext)) {
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId
        };
      }
    }
  } catch (e) {
    // OpenTelemetry API not installed or active, ignore safely
  }
  return {};
}

/**
 * Internal function to dispatch log to configured transports.
 */
function dispatch(logEntry) {
  const output = JSON.stringify(logEntry);

  if (config.transports.includes('console')) {
    if (logEntry.level === 'error') console.error(output);
    else if (logEntry.level === 'warn') console.warn(output);
    else if (logEntry.level === 'debug') console.debug(output);
    else console.log(output);
  }

  if (config.transports.includes('file') && config.filePath) {
    fs.appendFile(config.filePath, output + '\n', (err) => {
      if (err) console.error('OpenInfra Logger: Failed to write to log file', err);
    });
  }

  if (config.transports.includes('remote') && config.remoteUrl && typeof fetch !== 'undefined') {
    // Fire and forget remote logging
    fetch(config.remoteUrl, {
      method: 'POST',
      headers: config.remoteHeaders,
      body: output
    }).catch(err => {
      // Avoid circular logging loops, just output to native console.error
      console.error('OpenInfra Logger: Failed to send remote log', err.message);
    });
  }
}

/**
 * Emits a structured JSON log.
 * @param {string} message - The log message
 * @param {string} [level='info'] - The log severity level (debug, info, warn, error)
 * @param {object} [metadata={}] - Additional context for the log
 */
function log(message, level = 'info', metadata = {}) {
  const normalizedLevel = level.toLowerCase();
  
  if (!LEVELS[normalizedLevel]) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: `Invalid log level '${level}' provided, falling back to 'info'`,
      timestamp: new Date().toISOString()
    }));
    level = 'info';
  }

  // Inject default metadata and OpenTelemetry traceId if present
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,
    message,
    ...config.defaultMetadata,
    ...extractTraceContext(),
    ...metadata
  };

  dispatch(logEntry);
}

module.exports = { log, configure, LEVELS };
