/**
 * OpenInfra Logger
 * Critical infrastructure library for structured observability.
 * 
 * @author Jonathas Cordeiro (@jonathascordeiro20)
 * @license MIT
 * @copyright (c) 2026 Jonathas Cordeiro
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
  defaultMetadata: {},
  formatter: 'default' // 'default', 'datadog', 'elastic'
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
function dispatch(logEntry, originalLevel) {
  const output = JSON.stringify(logEntry);

  if (config.transports.includes('console')) {
    if (originalLevel === 'error') console.error(output);
    else if (originalLevel === 'warn') console.warn(output);
    else if (originalLevel === 'debug') console.debug(output);
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
  let logEntry = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,
    message,
    ...config.defaultMetadata,
    ...extractTraceContext(),
    ...metadata
  };

  // Apply ecosystem-specific formatters
  if (config.formatter === 'datadog') {
    logEntry.status = logEntry.level;
    delete logEntry.level;
    if (logEntry.trace_id) {
      logEntry['dd.trace_id'] = logEntry.trace_id;
      delete logEntry.trace_id;
    }
    if (logEntry.span_id) {
      logEntry['dd.span_id'] = logEntry.span_id;
      delete logEntry.span_id;
    }
  } else if (config.formatter === 'elastic') {
    logEntry['@timestamp'] = logEntry.timestamp;
    delete logEntry.timestamp;
    logEntry['log.level'] = logEntry.level;
    delete logEntry.level;
  }

  dispatch(logEntry, normalizedLevel);
}

module.exports = { log, configure, LEVELS };
