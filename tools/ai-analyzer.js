#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const LOG_FILE = process.argv[2] || 'app.log';

console.log(`\n🤖 OpenInfra Logger: AI Root Cause Analyzer`);
console.log(`===========================================\n`);

const fullPath = path.resolve(process.cwd(), LOG_FILE);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: Log file not found at ${fullPath}`);
  console.log(`Usage: npm run analyze <path-to-log-file>`);
  process.exit(1);
}

console.log(`📄 Analyzing log file: ${LOG_FILE}...`);
const fileContent = fs.readFileSync(fullPath, 'utf8');
const lines = fileContent.split('\n').filter(l => l.trim() !== '');

const errors = [];
for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    // Support our standard JSON, datadog format, and elastic format
    const level = entry.level || entry.status || entry['log.level'];
    if (level === 'error' || level === 'warn') {
      errors.push(entry);
    }
  } catch (e) {
    // Ignore non-JSON lines
  }
}

if (errors.length === 0) {
  console.log(`✅ No errors or warnings found in the log file. Systems are healthy!`);
  process.exit(0);
}

console.log(`🔍 Found ${errors.length} anomalies/errors. Preparing AI analysis...`);

const prompt = `
You are an expert Site Reliability Engineer (SRE). Please analyze the following structured JSON logs from our infrastructure. 
Identify the root cause of the errors, highlight any anomalies, and provide actionable steps to resolve the issue.

Logs:
${JSON.stringify(errors, null, 2)}
`;

if (!API_KEY) {
  console.log(`\n⚠️  ANTHROPIC_API_KEY environment variable is not set.`);
  console.log(`\nTo get an automated Root Cause Analysis, please set the variable or copy the prompt below and paste it into https://claude.ai:\n`);
  console.log(`--- COPY BELOW THIS LINE ---\n`);
  console.log(prompt);
  console.log(`\n--- COPY ABOVE THIS LINE ---`);
  process.exit(0);
}

console.log(`🧠 Connecting to Anthropic Claude API...\n`);

fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1000,
    messages: [
      { role: 'user', content: prompt }
    ]
  })
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error(`❌ API Error: ${data.error.message}`);
    process.exit(1);
  }
  console.log(`💡 Root Cause Analysis Report:\n`);
  console.log(data.content[0].text);
})
.catch(err => {
  console.error(`❌ Network Error: Failed to reach Anthropic API.`, err.message);
});
