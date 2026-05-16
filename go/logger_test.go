package openinfralogger

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func tempLogFile(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "go.log")
}

func readLastJSON(t *testing.T, path string) map[string]interface{} {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log file: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) == 0 {
		t.Fatal("log file is empty")
	}
	var out map[string]interface{}
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &out); err != nil {
		t.Fatalf("invalid JSON in log file: %v\n%s", err, lines[len(lines)-1])
	}
	return out
}

func TestFileTransportDefaultFormatter(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{"service": "go-svc"},
		RemoteHeaders:   map[string]string{},
	})
	Log("hello go", "info", map[string]interface{}{"id": 42})

	e := readLastJSON(t, logPath)
	if e["message"] != "hello go" {
		t.Errorf("message = %v", e["message"])
	}
	if e["level"] != "info" {
		t.Errorf("level = %v", e["level"])
	}
	if e["service"] != "go-svc" {
		t.Errorf("default metadata not merged: %v", e["service"])
	}
	if v, ok := e["id"].(float64); !ok || v != 42 {
		t.Errorf("id = %v (%T)", e["id"], e["id"])
	}
	if _, ok := e["timestamp"].(string); !ok {
		t.Errorf("timestamp missing or wrong type")
	}
}

func TestDatadogFormatter(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "datadog",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})
	Log("dd msg", "warn", map[string]interface{}{"trace_id": "t1", "span_id": "s1"})

	e := readLastJSON(t, logPath)
	if e["status"] != "warn" {
		t.Errorf("status expected 'warn', got %v", e["status"])
	}
	if _, has := e["level"]; has {
		t.Errorf("level should be removed in datadog formatter")
	}
	if e["dd.trace_id"] != "t1" {
		t.Errorf("dd.trace_id = %v", e["dd.trace_id"])
	}
	if e["dd.span_id"] != "s1" {
		t.Errorf("dd.span_id = %v", e["dd.span_id"])
	}
}

func TestElasticFormatter(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "elastic",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})
	Log("es msg", "error", nil)

	e := readLastJSON(t, logPath)
	if e["log.level"] != "error" {
		t.Errorf("log.level = %v", e["log.level"])
	}
	if _, has := e["level"]; has {
		t.Errorf("level should be removed in elastic formatter")
	}
	if _, has := e["@timestamp"]; !has {
		t.Errorf("@timestamp missing")
	}
	if _, has := e["timestamp"]; has {
		t.Errorf("timestamp should be removed in elastic formatter")
	}
}

func TestInvalidLevelFallsBackToInfo(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})
	Log("bogus", "verbose", nil)

	e := readLastJSON(t, logPath)
	if e["level"] != "info" {
		t.Errorf("invalid level must fall back to info, got %v", e["level"])
	}
}

func TestUppercaseLevelNormalized(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})
	Log("shouted", "ERROR", nil)

	e := readLastJSON(t, logPath)
	if e["level"] != "error" {
		t.Errorf("expected normalized 'error', got %v", e["level"])
	}
}

func TestSpecialCharsEscaped(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})
	Log(`quotes: "hi" \ newline`+"\n"+`here	tab 🚀 中文`, "info", map[string]interface{}{"k": `with "quotes"`})

	e := readLastJSON(t, logPath)
	msg, _ := e["message"].(string)
	if !strings.Contains(msg, `"hi"`) {
		t.Errorf("missing quotes in message: %q", msg)
	}
	if !strings.Contains(msg, "\n") {
		t.Errorf("missing newline in message: %q", msg)
	}
	if !strings.Contains(msg, "🚀") {
		t.Errorf("missing emoji in message: %q", msg)
	}
	if e["k"] != `with "quotes"` {
		t.Errorf("metadata not preserved: %v", e["k"])
	}
}

func TestBurstWritesProduceValidJSON(t *testing.T) {
	logPath := tempLogFile(t)
	Configure(Config{
		Transports:      []string{"file"},
		FilePath:        logPath,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{},
	})

	var wg sync.WaitGroup
	N := 100
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			Log("burst", "info", map[string]interface{}{"i": i})
		}(i)
	}
	wg.Wait()

	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != N {
		t.Errorf("expected %d lines, got %d", N, len(lines))
	}
	for i, ln := range lines {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(ln), &m); err != nil {
			t.Errorf("line %d invalid JSON: %v\n%s", i, err, ln)
		}
	}
}

func TestRemoteTransportSendsJSON(t *testing.T) {
	received := make(chan []byte, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		received <- buf
		w.WriteHeader(200)
	}))
	defer srv.Close()

	Configure(Config{
		Transports:      []string{"remote"},
		RemoteURL:       srv.URL,
		Formatter:       "default",
		DefaultMetadata: map[string]interface{}{},
		RemoteHeaders:   map[string]string{"Content-Type": "application/json"},
	})

	Log("remote msg", "info", map[string]interface{}{"k": "v"})

	select {
	case body := <-received:
		var entry map[string]interface{}
		if err := json.Unmarshal(body, &entry); err != nil {
			t.Fatalf("remote payload not valid JSON: %v\n%s", err, body)
		}
		if entry["message"] != "remote msg" {
			t.Errorf("remote message = %v", entry["message"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for remote delivery")
	}
}
