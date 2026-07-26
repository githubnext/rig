---
name: Rig Integration Tests
description: >
  Run the rig SDK integration tests against the live Copilot API using
  copilot-requests:write. Installs dependencies and executes the vitest
  integration suite, reporting pass/fail results.
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  copilot-requests: write
engine:
  id: copilot
  copilot-sdk: true
strict: true
timeout-minutes: 15
tools:
  bash: ["*"]
network:
  allowed: [defaults, node]
---

## Task

Run the rig SDK integration tests against the live Copilot API.

1. Install dependencies:
   ```
   npm ci
   ```

2. Run the integration test suite:
   ```
   npm run test:integration
   ```

3. Report whether all tests passed or list any failures with their error output.
