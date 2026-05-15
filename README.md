# OpenInfra Logger

![NPM Version](https://img.shields.io/npm/v/openinfra-logger) ![License](https://img.shields.io/npm/l/openinfra-logger) ![Build Status](https://img.shields.io/github/actions/workflow/status/jonathascordeiro20/openinfra-logger/ci.yml)

**OpenInfra Logger** is a robust, structured logging and observability library designed for Node.js and Python applications. It serves as an invisible yet critical piece of infrastructure, ensuring modern applications maintain unparalleled visibility into their security, performance, and operational health.

## Ecosystem Impact & Criticality

In the landscape of modern distributed systems, logging is not merely an auxiliary feature; it is foundational, invisible infrastructure. Without structured, reliable, and standardized logging, applications operate blindly. **OpenInfra Logger** provides the critical observability backbone required by high-stakes environments—such as **Fintechs**, **E-commerce platforms**, and enterprise **SaaS** solutions—making it possible to detect security breaches, diagnose performance bottlenecks, and understand system behavior at scale.

**OpenInfra Logger** addresses ecosystem fragmentation by providing:
- **Consistent Observability**: A unified structured JSON format across Node.js and Python, eliminating parsing complexities.
- **Reliability at Scale**: Built to be lightweight with minimal overhead, supporting Console, File, and Remote transports.
- **Future-Proofing**: Designed from the ground up for seamless integration with standards like OpenTelemetry.

## Installation

```bash
npm install openinfra-logger
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

## Roadmap

Our vision is to become the standard logging infrastructure across diverse modern tech stacks.

- [x] Node.js core implementation (Console, File, Remote Transports)
- [ ] Native OpenTelemetry Tracing integration (traceId injection)
- [ ] Support for Python
- [ ] Support for Rust and Go
- [ ] Seamless Integrations with Grafana, Datadog, ELK stack
- [ ] AI-powered log analysis and anomaly detection

## License

This project is licensed under the [MIT License](LICENSE). Please review our [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.
