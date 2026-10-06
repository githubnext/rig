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
model: copilot/auto
engine:
  id: codex
  config: |
    [shell_environment_policy.set]
    RIG_JUDGE_ENGINE = "codex"
    CODEX_HOME = "/tmp/gh-aw/mcp-config"
    GH_AW_MODEL_AGENT_CODEX = "auto"
    CODEX_API_KEY = "awf-proxy"
tools:
  bash: ["*"]
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
three judges use the workflow's `copilot/auto` routing through the AWF gateway.
Inherit the harness's Codex configuration; do not supply an OpenAI API key,
replace the proxy endpoint, or choose a fixed model.
The explicit shell environment settings preserve only the fixture selector,
model, config path, and a non-secret proxy placeholder, not upstream credentials.
