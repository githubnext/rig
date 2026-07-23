# Skill: repo-memory-reader

Load durable repository knowledge that is relevant to the current pass.

Read memory for:

- merge gates and branch protection expectations
- label meanings
- known flaky checks and rerun policy
- reusable accepted fixes
- review patterns that affect mergeability
- prior skill outcomes
- velocity metrics

Return only relevant memory with source filenames or identifiers. Current GitHub
state wins over stale or contradictory memory.
