# Evergreen Memory Policy

Memory is for future-useful facts, not run logs.

Store:

- merge gates and branch protection expectations
- label meanings
- CI failure signatures
- known flaky checks and rerun policy
- reusable accepted fixes
- review patterns that affect mergeability
- skill outcomes
- velocity metrics
- per-PR blockers and attempts to avoid

Do not store secrets, raw logs, large diffs, or stale speculation. Write small,
structured, source-aware entries.
