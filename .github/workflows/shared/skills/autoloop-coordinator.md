# Skill: autoloop-coordinator

Use when an automation-authored PR is still receiving generated feature commits
or is too large for ordinary greenkeeping.

Detect whether the target is moving, whether iteration should pause while gates
are repaired, and whether the PR should be split, stacked, or escalated. Resume
feature iteration only after verified gate evidence supports it.
