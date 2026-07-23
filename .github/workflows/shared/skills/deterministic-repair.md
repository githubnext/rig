# Skill: deterministic-repair

Prefer deterministic repo-native commands and mechanical fixes before agentic
edits.

When a configured CI gate reports a failing command, run the narrowest matching
repo-native command locally before editing if the trust policy allows code
execution. If the needed command is not available or not allowed by workflow
tools, report that as missing tool access instead of guessing.

Find documented commands for:

- install
- build
- lint
- format
- typecheck
- test
- code generation
- workflow compilation or validation

Prefer targeted commands over broad commands. Apply or propose the smallest
safe patch that clears the current failing gate, not just the first diagnostic.
For lint and typecheck failures, fix all current mechanical diagnostics from the
same command when they are local and low-risk, then rerun the command before
pushing. Prioritize structural blockers, such as large complexity or control
flow issues, before warning churn that cannot make the gate pass. Route policy
conflicts to the appropriate review or human decision instead of guessing.
