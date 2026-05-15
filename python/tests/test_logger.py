import unittest
import json
import os
import time

# Hack to allow running tests from project root
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from python.openinfra_logger import log, configure

class TestOpenInfraLogger(unittest.TestCase):
    def setUp(self):
        self.test_file = './test_python.log'
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def tearDown(self):
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def test_file_transport_and_default_formatter(self):
        configure(
            transports=['file'],
            file_path=self.test_file,
            formatter='default',
            default_metadata={'env': 'test_py'}
        )
        log("Python file test", "info", {"testId": 999})
        
        time.sleep(0.1) # Wait for async-like behavior if any
        self.assertTrue(os.path.exists(self.test_file))

        with open(self.test_file, 'r') as f:
            content = f.read().strip()
            parsed = json.loads(content)

            self.assertEqual(parsed['message'], "Python file test")
            self.assertEqual(parsed['level'], "info")
            self.assertEqual(parsed['env'], "test_py")
            self.assertEqual(parsed['testId'], 999)
            self.assertIn("timestamp", parsed)

    def test_datadog_formatter(self):
        configure(
            transports=['file'],
            file_path=self.test_file,
            formatter='datadog'
        )
        log("Datadog python test", "warn", {"trace_id": "py-abc"})
        
        time.sleep(0.1)
        with open(self.test_file, 'r') as f:
            content = f.read().strip()
            parsed = json.loads(content)

            self.assertEqual(parsed['status'], "warn")
            self.assertNotIn("level", parsed)
            self.assertEqual(parsed['dd.trace_id'], "py-abc")
            self.assertNotIn("trace_id", parsed)

    def test_elastic_formatter(self):
        configure(
            transports=['file'],
            file_path=self.test_file,
            formatter='elastic'
        )
        log("Elastic python test", "error")
        
        time.sleep(0.1)
        with open(self.test_file, 'r') as f:
            content = f.read().strip()
            parsed = json.loads(content)

            self.assertEqual(parsed['log.level'], "error")
            self.assertNotIn("level", parsed)
            self.assertIn("@timestamp", parsed)
            self.assertNotIn("timestamp", parsed)

if __name__ == '__main__':
    unittest.main()
