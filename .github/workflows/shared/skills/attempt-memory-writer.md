# Skill: attempt-memory-writer

Write structured memory for future-useful attempt state.

Record:

- PR number
- raw head SHA
- semantic head key when available
- failure signatures
- selected skills
- deterministic commands run
- patches or safe outputs attempted
- safe-output verification status
- repeated attempts to avoid
- next action

Do not write secrets, raw logs, or noisy run transcripts. Ignore trigger-only
empty commits when updating semantic attempt counters.
