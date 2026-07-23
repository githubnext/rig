# Skill: ci-run-deduper

Collapse duplicate CI/check runs into logical gates.

Group runs by:

- current PR head SHA
- workflow name
- job or check name
- conclusion or state

Treat duplicate `push` and `pull_request` runs for the same head as one logical
gate unless their conclusions disagree. Return the logical gate list and the raw
run/check identifiers used as evidence.
