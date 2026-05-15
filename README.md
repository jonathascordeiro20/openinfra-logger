# OpenInfra Logger

![NPM Version](https://img.shields.io/npm/v/openinfra-logger) ![License](https://img.shields.io/npm/l/openinfra-logger) ![Build Status](https://img.shields.io/github/actions/workflow/status/jonathascordeiro20/openinfra-logger/ci.yml)

**OpenInfra Logger** is a robust, structured logging and observability library designed for Node.js and Python applications. It serves as an invisible yet critical piece of infrastructure, ensuring modern applications maintain unparalleled visibility into their security, performance, and operational health.

## Ecosystem Impact & Criticality

In the landscape of modern distributed systems, logging is not merely an auxiliary feature; it is foundational infrastructure. Without structured, reliable, and standardized logging, applications operate blindly, making it impossible to detect security breaches, diagnose performance bottlenecks, or understand system behavior at scale. 

**OpenInfra Logger** addresses this by providing:
- **Consistent Observability**: A unified structured JSON format across Node.js and Python, eliminating parsing complexities.
- **Reliability at Scale**: Built to be lightweight with minimal overhead, ensuring zero impact on application performance.
- **Future-Proofing**: Designed from the ground up for seamless integration with standards like OpenTelemetry.

## Installation

```bash
npm install openinfra-logger
```

## Usage

```javascript
const { log } = require('openinfra-logger');

// Standard log levels
log('System initialized successfully', 'info');
log('Database connection retry attempt 1', 'warn');
log('Failed to parse incoming payload', 'error');
log('Detailed payload metrics', 'debug');
```

## Roadmap

Our vision is to become the standard logging infrastructure across diverse modern tech stacks.

- [x] Node.js core implementation
- [ ] Support for Python
- [ ] Support for Rust and Go
- [ ] Seamless Integrations with Grafana, Datadog, ELK stack
- [ ] AI-powered log analysis and anomaly detection
- [ ] Native OpenTelemetry Tracing integration

## License

This project is licensed under the [MIT License](LICENSE).
