# Skill: merge-blocker-comment-reader

Read human discussion only for merge-blocking signals.

Identify:

- requested changes that are configured merge gates
- unresolved review threads that block mergeability
- maintainer comments that explicitly require action before merge
- credential, deployment, release, policy, or ownership decisions

Ignore non-blocking suggestions and general review commentary. Return a blocker
map with source comment or review identifiers.
