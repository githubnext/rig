# Skill: pr-intake

Build a factual snapshot of the target pull request.

Inputs:

- Pull request number.
- Expected head SHA, if supplied by a trigger.
- Current repository policy.

Collect:

- title, author, draft state, base branch, head branch, and current head SHA
- labels and state labels
- changed files and risk-relevant path groups
- review decision and unresolved review threads when available
- recent process-relevant author, reviewer, and maintainer comments
- status checks and workflow runs for the current head SHA

Return facts only. Do not recommend fixes.
