package openinfralogger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type Config struct {
	Transports      []string
	FilePath        string
	RemoteURL       string
	RemoteHeaders   map[string]string
	DefaultMetadata map[string]interface{}
	Formatter       string
}

var currentConfig = Config{
	Transports:      []string{"console"},
	FilePath:        "./app.log",
	RemoteHeaders:   map[string]string{"Content-Type": "application/json"},
	DefaultMetadata: make(map[string]interface{}),
	Formatter:       "default",
}

// Configure updates the logger configuration
func Configure(newConfig Config) {
	currentConfig = newConfig
}

// Log emits a structured JSON log
func Log(message string, level string, metadata map[string]interface{}) {
	normalizedLevel := strings.ToLower(level)
	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}

	if !validLevels[normalizedLevel] {
		log.Printf(`{"level":"warn","message":"Invalid log level '%s' provided, falling back to 'info'","timestamp":"%s"}`+"\n", level, time.Now().UTC().Format(time.RFC3339))
		normalizedLevel = "info"
	}

	logEntry := make(map[string]interface{})
	logEntry["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	logEntry["level"] = normalizedLevel
	logEntry["message"] = message

	// Merge default and specific metadata
	for k, v := range currentConfig.DefaultMetadata {
		logEntry[k] = v
	}
	if metadata != nil {
		for k, v := range metadata {
			logEntry[k] = v
		}
	}

	// Apply Formatter
	if currentConfig.Formatter == "datadog" {
		logEntry["status"] = logEntry["level"]
		delete(logEntry, "level")
		if traceID, ok := logEntry["trace_id"]; ok {
			logEntry["dd.trace_id"] = traceID
			delete(logEntry, "trace_id")
		}
		if spanID, ok := logEntry["span_id"]; ok {
			logEntry["dd.span_id"] = spanID
			delete(logEntry, "span_id")
		}
	} else if currentConfig.Formatter == "elastic" {
		logEntry["@timestamp"] = logEntry["timestamp"]
		delete(logEntry, "timestamp")
		logEntry["log.level"] = logEntry["level"]
		delete(logEntry, "level")
	}

	dispatch(logEntry, normalizedLevel)
}

func dispatch(logEntry map[string]interface{}, originalLevel string) {
	outputBytes, _ := json.Marshal(logEntry)
	output := string(outputBytes)

	for _, transport := range currentConfig.Transports {
		if transport == "console" {
			fmt.Println(output)
		} else if transport == "file" && currentConfig.FilePath != "" {
			f, err := os.OpenFile(currentConfig.FilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err == nil {
				f.WriteString(output + "\n")
				f.Close()
			}
		} else if transport == "remote" && currentConfig.RemoteURL != "" {
			req, _ := http.NewRequest("POST", currentConfig.RemoteURL, bytes.NewBuffer(outputBytes))
			for k, v := range currentConfig.RemoteHeaders {
				req.Header.Set(k, v)
			}
			client := &http.Client{Timeout: 2 * time.Second}
			go client.Do(req) // Fire and forget
		}
	}
}
