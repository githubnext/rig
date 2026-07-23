---
name: Rig Samples Integration
description: Runs rig runtime integration samples as an agentic workflow smoke test.
on:
  workflow_dispatch:
  pull_request:
    paths:
      - "skills/rig/**"
      - "src/samples/**"
      - "scripts/haiku.integration.test.ts"
      - "package.json"
      - "package-lock.json"
      - "tsconfig.json"
permissions:
  contents: read
  pull-requests: read
  copilot-requests: write
strict: true
imports:
  - uses: shared/load-rig.md
safe-outputs:
  add-comment:
    hide-older-comments: true
    max: 1
  noop:
---

# Rig Samples Integration

## Task

Use this workflow as an integration test for rig by running several real-runtime samples.

1. Run the shared loader steps first.
2. Run `COPILOT_GITHUB_TOKEN="${GITHUB_TOKEN}" npm run test:integration` from `/home/runner/work/rig/rig`.
3. If the integration test command fails, stop and report the failure details.
4. If it succeeds on a pull request, call `add-comment` with:
   - the command that ran
   - the sample set (`01-single-agent-haiku.ts`, `56-single-agent-sonnet.ts`, `57-complex-integration-sonnet.ts`)
   - a short pass summary
5. If it succeeds outside pull request context, call `noop` with a brief success message.
