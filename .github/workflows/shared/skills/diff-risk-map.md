# Skill: diff-risk-map

Classify the pull request diff so the orchestrator can choose specialist work.

Risk groups:

- tests only
- docs only
- frontend or browser behavior
- backend or service behavior
- public API or contract
- data migration or persistence
- auth or security
- dependency or lockfile
- CI, workflow, runner, or infrastructure
- agent, workflow, or generated automation
- broad architecture or high-churn changes

Return the risk profile, evidence paths, and conditional skill routing hints.
