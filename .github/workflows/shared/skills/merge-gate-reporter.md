# Skill: merge-gate-reporter

Report gate evidence without owning the ready label.

Evaluate:

- current-head CI/check gates
- merge conflicts
- branch freshness
- draft state
- review and CODEOWNERS requirements
- unresolved review threads
- required and blocker labels
- docs, release, deployment, security, or other configured gates

Produce a concise gate table and one final state: return-to-controller,
blocked, needs-human, waiting, or continue. Do not request or mutate a ready
label.
