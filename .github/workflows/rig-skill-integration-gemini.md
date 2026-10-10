---
name: Rig Skill Integration - Gemini
description: Test Rig's headless Gemini CLI adapter with three typed judges.
intent: Detect regressions in typed Rig judgments through the Gemini CLI.
on:
  workflow_dispatch:
permissions:
  contents: read
model: gemini-2.5-flash
engine:
  id: gemini
  version: "0.62.0"
tools:
  bash: ["printf", "node"]
skills:
  - skills/rig
imports:
  - shared/rig-three-judges.md
strict: true
timeout-minutes: 15
env:
  RIG_JUDGE_ENGINE: gemini
---

# Rig Gemini three-judge integration

Use the headless Gemini CLI adapter, not the Copilot SDK. The harness provisions
the CLI and its `GEMINI_API_KEY` gateway routing. Inherit that configuration;
do not inspect the key, change endpoints, or install another CLI.
