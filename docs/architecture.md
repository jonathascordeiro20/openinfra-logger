# Architecture of OpenInfra Logger

## Design Philosophy

**OpenInfra Logger** is built on three core pillars:
1. **Zero-Configuration by Default**: It should work out of the box with sensible defaults for 99% of use cases.
2. **Predictable JSON Structure**: Every log emitted must be perfectly parsable by downstream aggregators (e.g., Elasticsearch, Datadog).
3. **Performance First**: The overhead of logging must be strictly bounded to prevent impact on application latency.

## Component Overview

- **Core Logger (`src/index.js`)**: The main entry point that normalizes inputs and formats them into JSON strings. It automatically handles standard streams (`stdout`, `stderr`).
- **Telemetry Hooks (Future)**: Designed to seamlessly inject tracing contexts (`traceId`, `spanId`) without requiring heavy dependencies.
