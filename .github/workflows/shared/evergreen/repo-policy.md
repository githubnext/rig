# Evergreen Repo Policy

## Merge Gates

- Required checks: `build-test` (typecheck + unit tests via `npm run typecheck` and `npm test`)
- Non-required checks treated as gates: `integration-test` (skipped without `COPILOT_GITHUB_TOKEN`; not a hard gate)
- Review requirements: none configured (inferred from closed PRs; agent-authored PRs merged without review)
- CODEOWNERS requirements: none detected
- Unresolved thread policy: do not block on unresolved review threads unless a maintainer explicitly marks one as blocking
- Draft PR repair policy: allow repair on labeled draft PRs; repo uses agents that create draft PRs
- Draft ready-for-review policy: do not mark draft PRs ready for review automatically
- Required labels: none beyond `evergreen`
- Active lease label: `evergreen_active`
- Blocker labels: none currently configured
- Deployment/environment gates: none detected
- Auto-merge behavior: auto-merge setting was not readable; Evergreen does not directly merge PRs

## Readiness Controller

- Ready label: `evergreen-ready`
- Controller owns ready label: yes
- Add ready label only when: `build-test` passes for the current head SHA and mergeStateStatus is MERGEABLE
- Remove ready label when: any configured gate fails, head SHA changes, branch is behind, or PR becomes a merge conflict
- Current-head SHA policy: evaluate on the SHA reported by the preflight job; stop if head changes mid-run
- Failing check policy: dispatch repair when a configured gate is visibly failing for the current head SHA, even if other configured checks are still missing or skipped
- Pending check policy: wait; do not re-trigger pending checks
- Missing/stale check policy: activate CI when evidence is missing or stale, then stop so a later reconciliation can classify the resulting checks
- Branch freshness ready criterion: mergeStateStatus must not be BEHIND
- Additional deterministic ready criteria: PR must be open and not labeled `evergreen-exhausted`

## Branch Updates

- Base branch: `main`
- Freshness requirement: GitHub must report mergeStateStatus as not BEHIND
- Branch update policy: controller-owned; the deterministic controller asks GitHub to update the PR branch with an expected head SHA when possible. The agent must not run `git merge`, `git rebase`, or include base-branch update commits in safe-output patches.
- Rebase or force-push policy: no force-push; use GitHub branch-update API only
- Fork PR behavior: not applicable (private repo, no fork PRs expected)

## Trust Model

- Repository visibility: private (githubnext organization)
- Fork PR policy: not applicable; fork PRs are not expected
- Are PR branch pushers trusted: yes; all contributors are org members or invited collaborators
- Default trust level: `trusted-branch`
- Current-head approval policy: not required; all pushers are trusted
- Authorized `/evergreen` users: not configured; not required for private repo
- What invalidates approval: not applicable

## Event Fast Paths

- `pull_request` activity types: not wired directly to the gh-aw workflow by default
- Default-branch `push` policy: not wired; schedule and `workflow_dispatch` only
- `workflow_run` policy: not wired; use schedule reconciliation
- Review event policy: not wired
- Deployment event policy: not applicable
- Slash-command policy: not configured
- Schedule interval: every 15 minutes

## CI/CD Activation

- Workflows/checks Evergreen may rerun: `CI` (`ci.yml`) — specifically the `build-test` job
- Workflows/checks Evergreen may dispatch: none (ci.yml has no `workflow_dispatch` trigger)
- Stale check policy: rerun the most recent `ci.yml` run for the current head SHA; do not rerun green checks or re-trigger an already in-progress run
- Missing check policy: rerun the most recent `ci.yml` run for the current head SHA; if no run exists, report as blocked
- Empty commit policy: do not use empty trigger commits; ci.yml runs on `pull_request` events automatically
- Token policy: `GITHUB_TOKEN` is sufficient; no `EVERGREEN_GITHUB_TOKEN` or PAT required

## Repair Policy

- Allowed edits: TypeScript source files, test files, markdown docs, config files changed by the PR; `skills/rig/`, `src/`, `scripts/`
- Protected files: `.github/workflows/*.yml`, `.github/workflows/*.lock.yml`, `package-lock.json` (prefer `npm install`), `skills/rig/rig.ts` core (high-risk; require explicit reasoning)
- High-risk file policy: for changes to `skills/rig/rig.ts`, require failing test evidence before patching; prefer smallest safe change
- Gate-clearing policy: run `npm run typecheck` then `npm test`; fix all mechanical diagnostics in a single coherent commit; prioritize structural blockers before warning churn
- Deterministic commands:
  - `npm ci` — install dependencies
  - `npm run typecheck` — TypeScript typecheck
  - `npm test` — unit tests (vitest)
  - `npm run sample` — stub sample runner
  - `gh aw compile` — compile agentic workflow files
- CI/lint diagnosis policy: reproduce locally with `npm run typecheck` or `npm test` before patching; read full job logs before classifying a failure
- Generated file policy: `.lock.yml` files are compiler-generated; regenerate with `gh aw compile` when `*.md` workflow source changes
- Signed commit policy: not required

## Review Policy

- Reviewer request policy: do not request or re-request reviewers automatically
- Review thread policy: do not resolve review threads; comment only
- Human-needed cases: merge conflicts requiring content judgment, protected-branch policy changes, secrets or credential issues, `skills/rig/rig.ts` core API changes, release gating
- Comment style: terse; no emojis; include evidence source and next action

## Skills

- Vendored generic skills: pr-intake, repo-memory-reader, diff-risk-map, ci-run-deduper, ci-gate-evaluator, ci-log-parser, merge-blocker-comment-reader, deterministic-repair, safe-output-verifier, attempt-memory-writer, merge-gate-reporter, autoloop-coordinator, api-contract-gate-repair, dependency-gate-repair, security-gate-repair, lint-policy-review, infra-ci-repair, docs-release-gate-repair
- Existing repo skills to reuse: `.github/workflows/shared/github-guard-policy.md`, `.github/workflows/shared/noop-reminder.md`
- Conditional skills enabled: `autoloop-coordinator` when the PR is still receiving agent-authored commits; `dependency-gate-repair` when lockfile changes are involved; `lint-policy-review` when lint output looks policy-driven
- Skills not to use: `frontend-e2e-repair`, `playground-e2e-diagnoser`, `performance-gate-repair`, `data-migration-gate-repair` (not applicable to this repo)

## Quotas

- Per-PR AIC/token/cost budget: default Copilot engine budget (org billing)
- Max runs: 10 scheduled runs per PR label application
- Max repeated attempts per failure signature: 3
- Wall-clock limit: 60 minutes per run (timeout-minutes: 60)
- Exhaustion behavior: remove `evergreen`, add `evergreen-exhausted`, leave one terse comment, write memory

## Discovered Repo Context

- Agent guidance: `AGENTS.md` describes a TypeScript agent harness (rig); key commands are `npm run typecheck`, `npm test`, `npm run sample`. Core runtime is `skills/rig/rig.ts`.
- Existing workflow conventions: workflows are `.md` source + `.lock.yml` compiled pairs; `aw.json` has `auto_upgrade: true`; all agentic workflows use the Copilot engine
- Last 50 closed PR process scan: PRs are mostly agent-authored (rig-sampler, daily tasks); no human review required for merge; CI must pass (`build-test`); no CODEOWNERS; integration test is optional (skipped without `COPILOT_GITHUB_TOKEN`)
- Uncertainties: auto-merge setting could not be read (403 on GraphQL); branch protection rules could not be read; `integration-test` is treated as non-required gate
