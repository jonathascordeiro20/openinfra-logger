# OpenInfra Logger

![NPM Version](https://img.shields.io/npm/v/@jonathascordeiro20/openinfra-logger) ![License](https://img.shields.io/npm/l/@jonathascordeiro20/openinfra-logger) ![Build Status](https://img.shields.io/github/actions/workflow/status/jonathascordeiro20/openinfra-logger/ci.yml)

**OpenInfra Logger** is a robust, structured logging and observability library designed for Node.js and Python applications. It serves as an invisible yet critical piece of infrastructure, ensuring modern applications maintain unparalleled visibility into their security, performance, and operational health.

## Ecosystem Impact & Criticality

In the landscape of modern distributed systems, logging is not merely an auxiliary feature; it is foundational, invisible infrastructure. Without structured, reliable, and standardized logging, applications operate blindly. **OpenInfra Logger** provides the critical observability backbone required by high-stakes environments—such as **Fintechs**, **E-commerce platforms**, and enterprise **SaaS** solutions—making it possible to detect security breaches, diagnose performance bottlenecks, and understand system behavior at scale.

**OpenInfra Logger** addresses ecosystem fragmentation by providing:
- **Consistent Observability**: A unified structured JSON format across Node.js and Python, eliminating parsing complexities.
- **Reliability at Scale**: Built to be lightweight with minimal overhead, supporting Console, File, and Remote transports.
- **Future-Proofing**: Designed from the ground up for seamless integration with standards like OpenTelemetry.

## Installation

```bash
npm install @jonathascordeiro20/openinfra-logger
```
For more details, see our [Installation Guide](docs/installation.md).

## Usage

### Basic Console Logging
```javascript
const { log } = require('openinfra-logger');

log('System initialized successfully', 'info');
log('Failed to parse incoming payload', 'error', { requestId: '123' });
```

### Advanced Configuration (File & Remote Transports)
```javascript
const { log, configure } = require('openinfra-logger');

// Configure the logger to write to a file and send to an aggregator
configure({
  transports: ['console', 'file', 'remote'],
  filePath: './production.log',
  remoteUrl: 'https://logs.my-infrastructure.com/ingest',
  defaultMetadata: { service: 'payment-gateway', env: 'production' }
});

log('Payment processed', 'info', { transactionId: 'abc-456' });
```

Check out the `examples/` directory for [Express Integration](examples/express-integration.js) and [Security Logging](examples/security-logging.js).
Read our [Advanced Configuration Guide](docs/advanced-configuration.md) for more capabilities.

### OpenTelemetry Tracing
**OpenInfra Logger** automatically detects if an OpenTelemetry trace context is active in your environment (both in Node.js and Python) and silently extracts the `trace_id` and `span_id`, injecting them into the JSON log payload with **zero configuration required**.
```javascript
const { trace } = require('@opentelemetry/api');
const { log } = require('@jonathascordeiro20/openinfra-logger');

const tracer = trace.getTracer('demo');
tracer.startActiveSpan('auth-request', (span) => {
  // Output JSON will magically contain "trace_id": "..." and "span_id": "..."
  log('User successfully authenticated'); 
  span.end();
});
```

### Ecosystem Integrations (Datadog & ELK)
Platforms like Datadog and Elastic have strict JSON schema requirements for linking logs to APM traces. **OpenInfra Logger** includes native formatters to instantly transform your logs.
```javascript
const { configure, log } = require('@jonathascordeiro20/openinfra-logger');

// Transforms `level` -> `status` and `trace_id` -> `dd.trace_id`
configure({ formatter: 'datadog' });

// Or for Elastic Common Schema (ECS):
// configure({ formatter: 'elastic' }); // Transforms `timestamp` -> `@timestamp`
```

### Enterprise Robustness (Security & Performance)
Built for high-stakes environments, the logger includes two critical enterprise features out-of-the-box:
1. **Auto-Redaction**: Keys like `password`, `token`, `secret`, `api_key`, and `credit_card` are automatically intercepted and replaced with `[REDACTED]` to prevent LGPD/GDPR leaks.
2. **Batched Remote Transport**: When sending logs to a remote API, the logger buffers them in memory and sends them in batches (e.g., every 100 logs or 2 seconds) to prevent overwhelming your infrastructure under high load.

## Roadmap

Our vision is to become the standard logging infrastructure across diverse modern tech stacks.

- [x] Node.js core implementation (Console, File, Remote Transports)
- [x] Native OpenTelemetry Tracing integration (traceId injection)
- [x] Support for Python
- [x] Seamless Integrations with Grafana, Datadog, ELK stack
- [x] Support for Rust and Go
- [x] AI-powered log analysis and anomaly detection

## AI-Powered Root Cause Analysis (Powered by Claude)
The **OpenInfra Logger** comes with a built-in AI assistant for Site Reliability Engineers (SREs). It can parse your log files, find anomalies, and consult the Anthropic Claude API to generate an instant Root Cause Analysis.

```bash
# Analyze a specific log file
npm run analyze app.log
```
*Note: Set the `ANTHROPIC_API_KEY` environment variable for automated API integration, or the tool will generate a prompt for you to paste into the Claude web interface.*

## License

This project is licensed under the [MIT License](LICENSE). Please review our [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

---
<div align="center">
  <b>Built with ❤️ by <a href="https://github.com/jonathascordeiro20">Jonathas Cordeiro</a></b><br>
  <i>An open source initiative for modern infrastructure observability.</i>
</div>
