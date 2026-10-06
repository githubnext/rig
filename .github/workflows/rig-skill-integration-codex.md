---
name: Rig Skill Integration - Codex
description: Test Rig's Codex SDK adapter with three Copilot-backed judges.
intent: Detect regressions in typed Rig judgments through the Codex SDK and Copilot gateway.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  copilot-requests: write
model: copilot/gpt-5.3-codex
engine:
  id: codex
  config: |
    [shell_environment_policy.set]
    RIG_JUDGE_ENGINE = "codex"
    CODEX_HOME = "/tmp/gh-aw/mcp-config"
    GH_AW_MODEL_AGENT_CODEX = "gpt-5.3-codex"
    CODEX_API_KEY = "awf-proxy"
tools:
  bash: false
  cli-proxy: false
  timeout: 240
mcp-servers:
  rig-fixture:
    type: http
    url: http://host.docker.internal:8766/mcp
    headers:
      Authorization: "Bearer ${{ steps.rig-fixture.outputs.token }}"
    allowed: [run_rig]
pre-agent-steps:
  - name: Start the fixture-only Rig MCP driver
    id: rig-fixture
    run: |
      RIG_FIXTURE_MCP_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"
      echo "::add-mask::$RIG_FIXTURE_MCP_TOKEN"
      echo "token=$RIG_FIXTURE_MCP_TOKEN" >> "$GITHUB_OUTPUT"
      export RIG_FIXTURE_MCP_TOKEN
      node .github/drivers/codex-fixture-mcp.ts > /tmp/gh-aw/agent/rig-fixture-mcp.log 2>&1 &
      driver_pid=$!
      for attempt in $(seq 1 30); do
        if ! kill -0 "$driver_pid" 2>/dev/null; then
          cat /tmp/gh-aw/agent/rig-fixture-mcp.log
          exit 1
        fi
        if curl --silent --fail http://localhost:8766/health > /dev/null; then
          exit 0
        fi
        sleep 1
      done
      echo "::error::Rig fixture MCP driver did not become ready"
      exit 1
skills:
  - skills/rig
imports:
  - shared/rig-three-judges.md
strict: true
timeout-minutes: 15
env:
  RIG_JUDGE_ENGINE: codex
---

# Rig Codex three-judge integration

Use the Codex SDK adapter, not the Copilot SDK. Both the outer engine and the
three judges use the workflow's `copilot/gpt-5.3-codex` model through the AWF gateway.
Inherit the harness's Codex configuration; do not supply an OpenAI API key,
replace the proxy endpoint, or change the configured model.
The explicit shell environment settings preserve only the fixture selector,
model, config path, and a non-secret proxy placeholder, not upstream credentials.
The Copilot compatibility adapter disables Codex's native shell tool.
Call the `rig-fixture` server's `run_rig` tool once with `{}` instead of Bash.
The trusted driver reads the required installed skill files, runs only the
checked-in fixture, and persists validated output for the post-step.
