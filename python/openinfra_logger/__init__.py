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
    'formatter': 'default', # 'default', 'datadog', 'elastic'
    'redact_keys': ['password', 'token', 'secret', 'api_key', 'credit_card'],
    'batch_size': 100,
    'flush_interval_ms': 2000
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

def redact_object(obj, keys_to_redact):
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            if k.lower() in keys_to_redact:
                result[k] = '[REDACTED]'
            else:
                result[k] = redact_object(v, keys_to_redact)
        return result
    elif isinstance(obj, list):
        return [redact_object(item, keys_to_redact) for item in obj]
    return obj

import threading
_remote_buffer = []
_flush_timer = None

def _flush_remote():
    global _remote_buffer, _flush_timer
    if not _remote_buffer:
        return
        
    payload = json.dumps(_remote_buffer)
    _remote_buffer = []
    
    if _flush_timer:
        _flush_timer.cancel()
        _flush_timer = None
        
    try:
        req = urllib.request.Request(
            _config['remote_url'], 
            data=payload.encode('utf-8'), 
            headers=_config['remote_headers'],
            method='POST'
        )
        urllib.request.urlopen(req, timeout=2.0)
    except Exception as e:
        _logger.error(json.dumps({
            "level": "error", 
            "message": f"OpenInfra Logger: Failed to send remote logs batch: {str(e)}",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }))

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
    redacted_entry = redact_object(log_entry, _config['redact_keys'])
    output = json.dumps(redacted_entry)

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
    global _flush_timer
    if 'remote' in _config['transports'] and _config.get('remote_url'):
        _remote_buffer.append(redacted_entry)
        if len(_remote_buffer) >= _config['batch_size']:
            _flush_remote()
        elif _flush_timer is None:
            _flush_timer = threading.Timer(_config['flush_interval_ms'] / 1000.0, _flush_remote)
            _flush_timer.daemon = True
            _flush_timer.start()

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
