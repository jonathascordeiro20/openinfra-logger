"""
OpenInfra Logger
Critical infrastructure library for structured observability.

@author Jonathas Cordeiro (@jonathascordeiro20)
@license MIT
@copyright (c) 2026 Jonathas Cordeiro
"""
import json
import logging
import datetime
import urllib.request
import urllib.error

# Internal configuration
_config = {
    'transports': ['console'], # console, file, remote
    'file_path': './app.log',
    'remote_url': None,
    'remote_headers': {'Content-Type': 'application/json'},
    'default_metadata': {},
    'formatter': 'default' # 'default', 'datadog', 'elastic'
}

_logger = logging.getLogger("openinfra_logger")
_logger.setLevel(logging.DEBUG)
# Disable default propagation so we can handle outputs cleanly
_logger.propagate = False

# Ensure we have a stream handler for console transport
if not _logger.handlers:
    _console_handler = logging.StreamHandler()
    _console_handler.setFormatter(logging.Formatter('%(message)s'))
    _logger.addHandler(_console_handler)

def configure(**kwargs):
    """
    Configure the logger transports and defaults.
    """
    _config.update(kwargs)

def extract_trace_context():
    """
    Attempt to extract trace context if OpenTelemetry is active.
    Zero-dependency check.
    """
    try:
        import opentelemetry.trace
        span = opentelemetry.trace.get_current_span()
        if span and span.is_recording():
            ctx = span.get_span_context()
            if ctx.is_valid:
                return {
                    'trace_id': format(ctx.trace_id, "032x"),
                    'span_id': format(ctx.span_id, "016x")
                }
    except ImportError:
        pass
    return {}

def _dispatch(log_entry, original_level):
    output = json.dumps(log_entry)

    # 1. Console transport
    if 'console' in _config['transports']:
        if original_level == 'error':
            _logger.error(output)
        elif original_level == 'warn':
            _logger.warning(output)
        elif original_level == 'debug':
            _logger.debug(output)
        else:
            _logger.info(output)

    # 2. File transport
    if 'file' in _config['transports'] and _config.get('file_path'):
        try:
            with open(_config['file_path'], 'a') as f:
                f.write(output + '\n')
        except Exception as e:
            _logger.error(json.dumps({
                "level": "error",
                "message": f"OpenInfra Logger: Failed to write to log file: {str(e)}",
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
            }))

    # 3. Remote transport
    if 'remote' in _config['transports'] and _config.get('remote_url'):
        try:
            req = urllib.request.Request(
                _config['remote_url'], 
                data=output.encode('utf-8'), 
                headers=_config['remote_headers'],
                method='POST'
            )
            # Fire and forget with a short timeout to prevent blocking
            urllib.request.urlopen(req, timeout=2.0)
        except Exception as e:
            _logger.error(json.dumps({
                "level": "error",
                "message": f"OpenInfra Logger: Failed to send remote log: {str(e)}",
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
            }))


def log(message: str, level: str = 'info', metadata: dict = None):
    """
    Emits a structured JSON log.
    """
    if metadata is None:
        metadata = {}
        
    normalized_level = level.lower()
    valid_levels = {'debug', 'info', 'warn', 'error'}
    
    if normalized_level not in valid_levels:
        _logger.warning(json.dumps({
            "level": "warn",
            "message": f"Invalid log level '{level}' provided, falling back to 'info'",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }))
        normalized_level = 'info'

    log_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "level": normalized_level,
        "message": message,
    }
    
    trace_context = extract_trace_context()

    # Merge default metadata, trace context, and specific metadata
    log_entry.update(_config['default_metadata'])
    log_entry.update(trace_context)
    log_entry.update(metadata)

    if _config['formatter'] == 'datadog':
        log_entry['status'] = log_entry.pop('level', 'info')
        if 'trace_id' in log_entry:
            log_entry['dd.trace_id'] = log_entry.pop('trace_id')
        if 'span_id' in log_entry:
            log_entry['dd.span_id'] = log_entry.pop('span_id')
    elif _config['formatter'] == 'elastic':
        log_entry['@timestamp'] = log_entry.pop('timestamp')
        log_entry['log.level'] = log_entry.pop('level', 'info')

    _dispatch(log_entry, normalized_level)
