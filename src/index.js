/**
 * OpenInfra Logger
 * Critical infrastructure library for structured observability.
 */

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

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

  // TODO: Future integration point for OpenTelemetry traceId and spanId injection
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,
    message,
    ...metadata
  };

  const output = JSON.stringify(logEntry);

  if (normalizedLevel === 'error') {
    console.error(output);
  } else if (normalizedLevel === 'warn') {
    console.warn(output);
  } else if (normalizedLevel === 'debug') {
    console.debug(output);
  } else {
    console.log(output);
  }
}

module.exports = { log, LEVELS };
