---
name: Daily Rig Claude Dynamic Workflow Compatibility
description: >
  Each day, audits Rig workflow APIs, docs, and samples against Claude dynamic
  workflow patterns, applies one high-confidence compatibility improvement, and
  opens a draft PR when a meaningful update is warranted.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: read
  copilot-requests: write
model: claude-sonnet-4.6
engine:
  id: copilot
  max-continuations: 6
strict: true
timeout-minutes: 45
skills:
  - githubnext/rig/skills/rig/SKILL.md@5bc52e398de3e25b0dd6d01664a2edcd3e789fd2
tools:
  github:
    mode: gh-proxy
    toolsets: [default]
  bash: ["*"]
  edit:
network:
  allowed: [defaults, github, node]
steps:
  - name: Install dependencies
    run: npm ci
safe-outputs:
  create-pull-request:
    title-prefix: "[rig-claude] "
    labels: [automation, ai-agent]
    draft: true
    reviewers: [copilot]
    max-patch-size: 4096
    max-patch-files: 40
    allowed-files:
      - "README.md"
      - "skills/rig/SKILL.md"
      - "skills/rig/references/*.md"
      - "skills/rig/samples/*.md"
      - "skills/rig/rig.ts"
      - "skills/rig/engines/anthropic.ts"
      - "src/workflow.test.ts"
      - "src/rig.test.ts"
      - "src/engines/anthropic.test.ts"
---

# Daily Rig Claude Dynamic Workflow Compatibility

Keep Rig compatible — or intentionally near-compatible with documented
differences — with Claude dynamic workflows so model knowledge transfers cleanly.

## Read first

Read these files before deciding whether to edit anything:

- `README.md`
- `skills/rig/SKILL.md`
- `skills/rig/references/dynamic-workflows.md`
- `skills/rig/references/claude-workflow-conversion.md`
- `skills/rig/rig.ts`
- `skills/rig/engines/anthropic.ts`
- `src/workflow.test.ts`
- `skills/rig/samples/52-claude-design.md`
- `skills/rig/samples/60-workflow-parallel-linter.md`
- `skills/rig/samples/70-multi-file-subagent-summarizer.md`
- `skills/rig/samples/310-workflow-audit-verify.md`

Use targeted `rg` searches to confirm how the current API covers these Claude
dynamic workflow concepts: `meta`, `args`/typed input, agent calls,
schema-constrained calls, `parallel`, `pipeline`, `phase`, `log`, `budget`,
nested workflows, and model selection.

## Goal

Close the single highest-confidence compatibility or discoverability gap between
Claude dynamic workflows and Rig that you can justify from the codebase.

Prioritize work in this order:

1. Docs or reference clarifications that make the mapping obvious.
2. Samples that demonstrate Claude-to-Rig transfer directly.
3. Low-risk API and test changes only when Rig is already very close to the
   Claude behavior and the change is small, well-scoped, and easy to validate.

Do not add legacy compatibility bridges, broad refactors, or speculative new
APIs.

## Review checklist

- Check that each Claude workflow concept has an obvious Rig home:
  `meta`, `args`/`input`, `agent`, schema-constrained calls, `parallel`,
  `pipeline`, `phase`, `log`, `budget`, nested `workflow`, and model selection.
- Check that docs and samples use terms a Claude dynamic-workflow user would
  search for.
- Check that Anthropic Sonnet usage is visible where it materially helps
  transfer.
- Check whether one missing or weak sample is blocking transfer of knowledge.
- Prefer tightening existing docs or samples over adding duplicate material.

## Edit rules

- Make at most one cohesive change set.
- Keep sample code short and idiomatic.
- If you change API behavior, add or adjust tests in `src/workflow.test.ts` or
  a directly related test file.
- If a doc summary becomes stale after an API or test change, update that
  summary in the same PR.
- If no high-confidence improvement is warranted, emit `noop` with a short
  reason.

## Validation

After edits, run the smallest relevant set:

- If `skills/rig/rig.ts`, `skills/rig/engines/anthropic.ts`, `src/**/*.ts`, or
  tests changed: `npm run typecheck && npm test`
- If `skills/rig/samples/*.md` changed:
  `npm run sample -- --testNamePattern="skill markdown samples typecheck"`
- If only docs changed: no extra validation beyond checking the edited files for
  obvious broken links or stale references.

If a validation command fails, either fix the issue or revert the risky edit and
emit `noop`.

## Output

Emit exactly one `create-pull-request` safe output when you make a meaningful
change.

Use:

- `title`: `Improve Claude dynamic-workflow compatibility for rig`
- `branch`: `rig-claude-compat/<YYYY-MM-DD>`
- `body`:
  - compatibility gap addressed
  - why the change improves transfer from Claude dynamic workflows to Rig
  - files changed
  - validation run
  - remaining intentional differences, if any

If nothing meaningful changed, emit `noop`.
