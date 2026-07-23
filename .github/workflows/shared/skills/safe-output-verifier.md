# Skill: safe-output-verifier

Verify that every intended GitHub side effect actually landed.

After a safe output request, reload GitHub state and confirm:

- comments exist with the expected content and identifier
- labels were added or removed as expected
- workflow dispatch or rerun was accepted
- reviews or review comments exist
- PR branch pushes changed the head SHA to the expected commit
- the expected files changed on the PR branch

If verification fails, report the operation as blocked. Do not use completion
language for unverified side effects.
