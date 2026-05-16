<p align="center">
  <img src="brand/social/readme-banner-1600x400.svg" alt="OIL · OpenInfra Logger — Universal structured logging. Built from nothing but stdlib." width="100%" />
</p>

<h1 align="center">OIL · OpenInfra Logger</h1>

<p align="center">
  <strong>One log shape. Four runtimes. Zero dependencies.</strong><br/>
  <em>Universal structured logging · Auto-redaction · Native batching · AI root-cause analysis.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@jonathascordeiro20/openinfra-logger?style=flat-square&labelColor=0A0C10&color=FF5C28" alt="NPM Version" />
  <img src="https://img.shields.io/npm/l/@jonathascordeiro20/openinfra-logger?style=flat-square&labelColor=0A0C10&color=F4F2EC" alt="License" />
  <img src="https://img.shields.io/github/actions/workflow/status/jonathascordeiro20/openinfra-logger/ci.yml?style=flat-square&labelColor=0A0C10&color=00D9A3" alt="Build Status" />
  <img src="https://img.shields.io/badge/runtimes-Node%20·%20Python%20·%20Go%20·%20Rust-F4F2EC?style=flat-square&labelColor=0A0C10" alt="Runtimes" />
</p>

---

**OpenInfra Logger** (OIL) is a robust, structured logging and observability library for **Node.js, Python, Go and Rust**. It serves as an invisible yet critical piece of infrastructure, ensuring modern applications maintain unparalleled visibility into their security, performance, and operational health.

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

## Brand

<p align="center">
  <img src="brand/mark/mark.svg" alt="OIL mark" width="96" />
</p>

OIL ships with a complete brand kit. All assets are in [`brand/`](brand/) as scalable SVGs.

| Token  | Hex        | Use |
|--------|------------|-----|
| **Ink**    | `#0A0C10` | Primary surface on dark, body text on light |
| **Paper**  | `#F4F2EC` | Primary surface on light, text on dark |
| **Signal** | `#FF5C28` | The accent — marks, CTAs, one highlight per surface |
| **Mint**   | `#00D9A3` | `Shield active` status only (sparingly) |
| **Steel**  | `#6B7280` | Secondary text, meta |

**Typography** — [Geist](https://vercel.com/font/geist) (display, UI, body) · [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (code, CLI, labels)

**Assets** — `brand/mark/`, `brand/favicon/`, `brand/lockup/`, `brand/social/`. See [`brand/README.md`](brand/README.md) for the full catalog and HTML embed snippets. Open [`brand/gallery.html`](brand/gallery.html) in a browser for a visual inspection page.

## Landing page

A static, dependency-free landing page lives at [`landing/`](landing/). Same zero-dependency philosophy as the library: one HTML, one CSS, ~50 lines of vanilla JS, no build step.

```bash
python -m http.server -d landing 8080   # then open http://localhost:8080
```

Deploys directly to GitHub Pages, Vercel, Netlify or Cloudflare Pages. See [`landing/README.md`](landing/README.md) for instructions.

### Hostinger / shared hosting build

A self-contained, dependency-free static bundle ready for shared hosting is in [`dist/`](dist/) (~57 KB uncompressed, ~18 KB gzipped). Includes `.htaccess` (MIME types, gzip, cache, security headers), `robots.txt`, `sitemap.xml`, favicons and OG card.

Upload via Hostinger File Manager or FTP — drop the **contents** of `dist/` into `public_html/`. Full step-by-step in [`dist/README.md`](dist/README.md).

## License

---
<div align="center">
  <b>Built with ❤️ by <a href="https://github.com/jonathascordeiro20">Jonathas Cordeiro</a></b><br>
  <i>An open source initiative for modern infrastructure observability.</i>
</div>
