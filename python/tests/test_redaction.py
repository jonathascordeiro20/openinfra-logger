import unittest
import json
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from python.openinfra_logger import log, configure, redact_object


class TestRedaction(unittest.TestCase):
    def setUp(self):
        self.file = './py_redaction.log'
        if os.path.exists(self.file):
            os.remove(self.file)
        configure(
            transports=['file'],
            file_path=self.file,
            formatter='default',
            default_metadata={},
            redact_keys=['password', 'token', 'secret', 'api_key', 'credit_card']
        )

    def tearDown(self):
        if os.path.exists(self.file):
            os.remove(self.file)

    def _last_entry(self):
        with open(self.file, 'r') as f:
            lines = [l for l in f.read().splitlines() if l.strip()]
        return json.loads(lines[-1])

    def test_top_level_keys_redacted(self):
        log("login", "info", {"user": "alice", "password": "p@ss", "token": "xyz"})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertEqual(e["password"], "[REDACTED]")
        self.assertEqual(e["token"], "[REDACTED]")
        self.assertEqual(e["user"], "alice")

    def test_nested_keys_redacted(self):
        log("tx", "info", {"tx": {"amount": 100, "credit_card": "4111", "meta": {"api_key": "sk_X"}}})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertEqual(e["tx"]["credit_card"], "[REDACTED]")
        self.assertEqual(e["tx"]["meta"]["api_key"], "[REDACTED]")
        self.assertEqual(e["tx"]["amount"], 100)

    def test_arrays_redacted(self):
        log("batch", "info", {"items": [{"token": "a"}, {"token": "b"}, {"ok": True}]})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertEqual(e["items"][0]["token"], "[REDACTED]")
        self.assertEqual(e["items"][1]["token"], "[REDACTED]")
        self.assertTrue(e["items"][2]["ok"])

    def test_case_insensitive_keys(self):
        log("case", "info", {"Password": "a", "TOKEN": "b", "Api_Key": "c"})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertEqual(e["Password"], "[REDACTED]")
        self.assertEqual(e["TOKEN"], "[REDACTED]")
        self.assertEqual(e["Api_Key"], "[REDACTED]")

    def test_custom_keys_override(self):
        configure(redact_keys=['ssn'])
        log("ssn", "info", {"ssn": "123-45-6789", "password": "kept"})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertEqual(e["ssn"], "[REDACTED]")
        self.assertEqual(e["password"], "kept")

    def test_redact_object_pure_function(self):
        # Direct unit test of the helper, no I/O
        out = redact_object({"a": 1, "Password": "x", "nested": {"token": "y"}}, ['password', 'token'])
        self.assertEqual(out["Password"], "[REDACTED]")
        self.assertEqual(out["nested"]["token"], "[REDACTED]")
        self.assertEqual(out["a"], 1)

    def test_handles_none_values(self):
        log("nones", "info", {"a": None, "password": None})
        time.sleep(0.05)
        e = self._last_entry()
        self.assertIsNone(e["a"])
        self.assertEqual(e["password"], "[REDACTED]")


class TestLevels(unittest.TestCase):
    def setUp(self):
        self.file = './py_levels.log'
        if os.path.exists(self.file):
            os.remove(self.file)
        configure(
            transports=['file'],
            file_path=self.file,
            formatter='default',
            default_metadata={},
            redact_keys=[]
        )

    def tearDown(self):
        if os.path.exists(self.file):
            os.remove(self.file)

    def _last(self):
        with open(self.file, 'r') as f:
            lines = [l for l in f.read().splitlines() if l.strip()]
        return json.loads(lines[-1])

    def test_all_valid_levels(self):
        for lvl in ['debug', 'info', 'warn', 'error']:
            log(f"msg-{lvl}", lvl)
            time.sleep(0.02)
            e = self._last()
            self.assertEqual(e["level"], lvl)

    def test_uppercase_normalized(self):
        log("shouted", "ERROR")
        time.sleep(0.05)
        self.assertEqual(self._last()["level"], "error")

    def test_invalid_level_falls_back_to_info(self):
        log("bogus", "verbose")
        time.sleep(0.05)
        # Last entry should be the actual log with level 'info' (warning goes to console, not file)
        self.assertEqual(self._last()["level"], "info")

    def test_default_level_is_info(self):
        log("no level given")
        time.sleep(0.05)
        self.assertEqual(self._last()["level"], "info")


class TestTransportsAndJSON(unittest.TestCase):
    def setUp(self):
        self.file = './py_transports.log'
        if os.path.exists(self.file):
            os.remove(self.file)

    def tearDown(self):
        if os.path.exists(self.file):
            os.remove(self.file)

    def test_empty_transports_writes_nothing(self):
        configure(transports=[], file_path=self.file, default_metadata={}, redact_keys=[])
        log("silent", "info")
        time.sleep(0.05)
        self.assertFalse(os.path.exists(self.file))

    def test_burst_writes_yield_valid_json(self):
        configure(transports=['file'], file_path=self.file, formatter='default',
                  default_metadata={}, redact_keys=[])
        for i in range(100):
            log(f"burst-{i}", "info", {"i": i})
        time.sleep(0.3)
        with open(self.file, 'r') as f:
            lines = [l for l in f.read().splitlines() if l.strip()]
        self.assertEqual(len(lines), 100)
        for line in lines:
            json.loads(line)  # must not raise

    def test_special_chars_escaped(self):
        configure(transports=['file'], file_path=self.file, formatter='default',
                  default_metadata={}, redact_keys=[])
        log('quotes: "hi" \\ newline\nhere\ttab 🚀 中文', 'info', {"k": 'with "quotes"'})
        time.sleep(0.05)
        with open(self.file, 'r') as f:
            line = f.read().strip().splitlines()[-1]
        parsed = json.loads(line)
        self.assertIn('"hi"', parsed["message"])
        self.assertIn('\n', parsed["message"])
        self.assertIn('🚀', parsed["message"])

    def test_default_formatter_keeps_keys(self):
        configure(transports=['file'], file_path=self.file, formatter='default',
                  default_metadata={"service": "api"}, redact_keys=[])
        log("default", "info", {"extra": 1})
        time.sleep(0.05)
        with open(self.file, 'r') as f:
            line = f.read().strip().splitlines()[-1]
        e = json.loads(line)
        self.assertEqual(e["level"], "info")
        self.assertIn("timestamp", e)
        self.assertEqual(e["service"], "api")
        self.assertEqual(e["extra"], 1)

    def test_timestamp_is_iso8601(self):
        import datetime as dt
        configure(transports=['file'], file_path=self.file, formatter='default',
                  default_metadata={}, redact_keys=[])
        log("iso", "info")
        time.sleep(0.05)
        with open(self.file, 'r') as f:
            line = f.read().strip().splitlines()[-1]
        ts = json.loads(line)["timestamp"]
        # Accept both '...Z' and offset-aware; strip trailing Z for fromisoformat
        ts_norm = ts.replace('Z', '+00:00')
        dt.datetime.fromisoformat(ts_norm)  # must not raise


class TestFormattersEdge(unittest.TestCase):
    def setUp(self):
        self.file = './py_fmt.log'
        if os.path.exists(self.file):
            os.remove(self.file)

    def tearDown(self):
        if os.path.exists(self.file):
            os.remove(self.file)

    def _last(self):
        with open(self.file, 'r') as f:
            line = f.read().strip().splitlines()[-1]
        return json.loads(line)

    def test_datadog_span_id_renamed(self):
        configure(transports=['file'], file_path=self.file, formatter='datadog',
                  default_metadata={}, redact_keys=[])
        log("dd", "info", {"trace_id": "t1", "span_id": "s1"})
        time.sleep(0.05)
        e = self._last()
        self.assertEqual(e["dd.trace_id"], "t1")
        self.assertEqual(e["dd.span_id"], "s1")
        self.assertNotIn("trace_id", e)
        self.assertNotIn("span_id", e)

    def test_datadog_no_trace_still_valid(self):
        configure(transports=['file'], file_path=self.file, formatter='datadog',
                  default_metadata={}, redact_keys=[])
        log("dd2", "info")
        time.sleep(0.05)
        e = self._last()
        self.assertEqual(e["status"], "info")
        self.assertNotIn("level", e)

    def test_elastic_remaps_timestamp_and_level(self):
        configure(transports=['file'], file_path=self.file, formatter='elastic',
                  default_metadata={}, redact_keys=[])
        log("es", "warn", {"trace_id": "abc"})
        time.sleep(0.05)
        e = self._last()
        self.assertEqual(e["log.level"], "warn")
        self.assertIn("@timestamp", e)
        self.assertNotIn("level", e)
        self.assertNotIn("timestamp", e)


if __name__ == '__main__':
    unittest.main()
