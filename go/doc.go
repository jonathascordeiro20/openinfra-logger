// Package openinfralogger provides zero-dependency, structured JSON logging
// with sibling implementations for Node.js, Python and Rust. All four
// emit an identical JSON shape, so polyglot stacks see a single, consistent
// log format on Datadog, Elastic, Loki, or any backend that ingests JSON
// over file or HTTP.
//
// # Quickstart
//
//	import openinfralogger "github.com/jonathascordeiro20/openinfra-logger/go"
//
//	openinfralogger.Configure(openinfralogger.Config{
//	    Transports:      []string{"console", "file"},
//	    FilePath:        "./app.log",
//	    Formatter:       "datadog",
//	    DefaultMetadata: map[string]interface{}{"service": "checkout-api"},
//	})
//
//	openinfralogger.Log("order.placed", "info", map[string]interface{}{
//	    "order_id": "abc-123",
//	    "amount":   1999,
//	})
//
// # Formatters
//
// "default", "datadog" (level → status, trace_id → dd.trace_id), or
// "elastic" (timestamp → @timestamp, level → log.level).
//
// # Project links
//
//   - Source:        https://github.com/jonathascordeiro20/openinfra-logger
//   - Project site:  https://openinfralogger.fun
//   - Other runtimes: Node.js, Python, Rust
package openinfralogger
