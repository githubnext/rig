---
name: Rig Skill Integration - Pi
description: Test Rig's Pi agent-core adapter with three Copilot-backed judges.
intent: Detect regressions in typed Rig judgments through Pi and the Copilot gateway.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  copilot-requests: write
model: copilot/gpt-5.3-codex
engine:
  id: pi
  driver: pi_agent_core_driver.cjs
  config: |
    {
      "settings": {
        "extensions": ["${{ github.workspace }}/.github/drivers/pi-rig-extension.ts"]
      }
    }
tools:
  bash: ["printf", "node"]
skills:
  - skills/rig
imports:
  - shared/rig-three-judges.md
strict: true
timeout-minutes: 15
env:
  RIG_JUDGE_ENGINE: pi
---

# Rig Pi three-judge integration

Use the Pi agent-core adapter, not the Copilot SDK. Both the outer engine and
the three judges use `copilot/gpt-5.3-codex`. The fixture reads the harness-provisioned
Pi gateway model configuration; never substitute a native OpenAI or Anthropic
provider, inspect credentials, or choose a different model.

The managed SDK driver registers the trusted `run_rig` extension tool. Call it
**exactly once** with `{}`; do not use Bash or supply source, commands, paths,
model settings, or credentials. The tool launches the unchanged checked-in
fixture, supplies its empty input, and persists validated JSON for the post-step.
On tool failure or denial, report the exact error with `report_incomplete` and
stop; never retry or call `noop` on failure.
