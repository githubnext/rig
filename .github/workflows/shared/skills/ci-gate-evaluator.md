# Skill: ci-gate-evaluator

Explain failing, pending, stale, skipped, or missing CI gates.

Distinguish:

- configured required gates
- configured non-required gates
- pending checks
- stale checks from older SHAs
- missing checks
- failures caused by the pull request
- environment or infrastructure failures
- workflow activation failures
- likely flakes that still need evidence

Recommend the smallest next action: wait, rerun, dispatch, repair, escalate, or
return to the deterministic controller.
