import sys
import os

# Add the python directory to sys.path so we can import openinfra_logger without installing it
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'python')))

from openinfra_logger import log, configure

print('--- OpenInfra Python Logger Demonstration ---\n')

# Configure default metadata
configure(default_metadata={'service': 'payment-worker', 'env': 'staging'})

# Basic informational logging
log('Python worker initialized successfully', 'info', {'worker_id': 42})

# Debugging
log('Evaluating transaction payload', 'debug', {'bytes_processed': 2048})

# Warning
log('External API rate limit approaching', 'warn', {'remaining_quota': 50})

# Error
log('Failed to commit transaction to database', 'error', {'code': 'DB_TIMEOUT', 'retry': False})

print('\n--- End of Demonstration ---')
