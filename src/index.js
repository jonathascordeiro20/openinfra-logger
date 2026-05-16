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
  formatter: 'default', // 'default', 'datadog', 'elastic'
  redactKeys: ['password', 'token', 'secret', 'api_key', 'credit_card'],
  batchSize: 100,
  flushIntervalMs: 2000
};

/**
 * Configure the logger transports and defaults.
 * @param {object} newConfig - Configuration overrides
 */
function configure(newConfig = {}) {
  config = { ...config, ...newConfig };
}

/**
 * Deep clones an object and redacts sensitive keys.
 */
function redactObject(obj, keysToRedact) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(item => redactObject(item, keysToRedact));
  
  const result = {};
  for (const key in obj) {
    if (keysToRedact.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactObject(obj[key], keysToRedact);
    }
  }
  return result;
}

let remoteBuffer = [];
let flushTimeout = null;

// Serialize file writes through a promise chain so concurrent log() calls
// preserve emission order on disk. fs.appendFile is async; without this,
// bursty writes can interleave.
let fileWriteChain = Promise.resolve();
function appendToFileOrdered(filePath, line) {
  fileWriteChain = fileWriteChain.then(() => new Promise((resolve) => {
    fs.appendFile(filePath, line, (err) => {
      if (err) console.error('OpenInfra Logger: Failed to write to log file', err);
      resolve();
    });
  }));
  return fileWriteChain;
}

function flushRemote() {
  if (remoteBuffer.length === 0) return;
  
  const payload = JSON.stringify(remoteBuffer);
  remoteBuffer = [];

  if (config.remoteUrl && typeof fetch !== 'undefined') {
    fetch(config.remoteUrl, {
      method: 'POST',
      headers: config.remoteHeaders,
      body: payload
    }).catch(err => {
      console.error('OpenInfra Logger: Failed to send remote logs batch', err.message);
    });
  }
  
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
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
  const redactedLogEntry = redactObject(logEntry, config.redactKeys);
  const output = JSON.stringify(redactedLogEntry);

  if (config.transports.includes('console')) {
    if (originalLevel === 'error') console.error(output);
    else if (originalLevel === 'warn') console.warn(output);
    else if (originalLevel === 'debug') console.debug(output);
    else console.log(output);
  }

  if (config.transports.includes('file') && config.filePath) {
    appendToFileOrdered(config.filePath, output + '\n');
  }

  if (config.transports.includes('remote')) {
    remoteBuffer.push(redactedLogEntry);
    if (remoteBuffer.length >= config.batchSize) {
      flushRemote();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(flushRemote, config.flushIntervalMs);
    }
  }
}

/**
 * Emits a structured JSON log.
 * @param {string} message - The log message
 * @param {string} [level='info'] - The log severity level (debug, info, warn, error)
 * @param {object} [metadata={}] - Additional context for the log
 */
function log(message, level = 'info', metadata = {}) {
  let normalizedLevel = level.toLowerCase();

  if (!LEVELS[normalizedLevel]) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: `Invalid log level '${level}' provided, falling back to 'info'`,
      timestamp: new Date().toISOString()
    }));
    normalizedLevel = 'info';
  }

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
