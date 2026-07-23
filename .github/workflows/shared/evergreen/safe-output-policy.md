# Evergreen Safe Output Policy

Allowed safe outputs in v1:

- PR comments for meaningful work, blockers, human-needed decisions, quota
  exhaustion, or verified state changes.
- Non-ready state labels.
- PR branch pushes for PRs that still have the opt-in label and satisfy trust
  policy.
- Workflow dispatch or rerun according to repo policy.
- Pull request reviews or review comments only when configured.

Disallowed safe outputs in v1:

- Direct PR merge.
- Base-branch writes.
- Branch update commits that merge or rebase the base branch into the PR branch;
  branch freshness is controller-owned.
- Adding or removing the ready label from the agentic workflow.
- Secret disclosure in comments, logs, commits, generated policy, or memory.

Every safe output must be verified before the orchestrator describes it as
successful.
