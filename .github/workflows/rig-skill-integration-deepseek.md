---
name: Rig Skill Integration - DeepSeek Harness
description: Test Rig's DeepSeek Harness SDK adapter with three Copilot-backed judges.
intent: Detect regressions in typed Rig judgments through DeepSeek Harness and the Copilot gateway.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write
model: copilot/gpt-5.3-codex
engine:
  id: deepseek-harness
  version: "0.2.0-rc.2"
tools:
  bash: ["printf", "node"]
  github:
    mode: gh-proxy
    toolsets: [repos]
skills:
  - skills/rig
imports:
  - shared/deepseek-harness.md
  - shared/rig-three-judges.md
strict: true
timeout-minutes: 15
env:
  RIG_JUDGE_ENGINE: deepseek
  RIG_JUDGE_MODEL: copilot/gpt-5.3-codex
---

# Rig DeepSeek Harness three-judge integration

Use the DeepSeek Harness SDK adapter, not the Copilot SDK or the direct DeepSeek
API. The outer engine and all three judges use `copilot/gpt-5.3-codex` through
the AWF gateway. The shared engine discovers the gateway through
`/reflect` and writes its provider route to `$DSH_HOME/cordis.patch.yml`.
The fixture inherits that Harness home, selects the `awf-proxy` provider, and
passes only the non-secret proxy key to its SDK subprocesses.
`RIG_JUDGE_MODEL` preserves the model selector across native shell calls, which
strip inherited `DSH_*` values and rebuild managed facts such as `DSH_HOME`.
Do not supply a DeepSeek or OpenAI API key, inspect credentials, replace the
endpoint, or change the configured model.

Run the shared fixture pipeline **exactly once**, unchanged. The SDK runtime
is pinned to the same version as the outer CLI. Each judge owns a fresh
SDK session; no Rig repair, retry, or fourth synthesis call is permitted.
On failure or denial, report the exact error with `report_incomplete` and stop.
The post-step validates the saved JSON independently.

DeepSeek Harness does not enforce gh-aw's Bash allowlist. Its outer agent runs
with unattended native tools inside AWF; judge subprocesses use a read-only
policy and a scrubbed environment. Do not treat the listed commands as a
security boundary. Use the generated `safeoutputs` CLI for `noop` or
`report_incomplete`; do not call nonexistent MCP tools.
