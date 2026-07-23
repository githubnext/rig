---
permissions:
  contents: read
network:
  allowed: [defaults, github, node]
tools:
  github:
    mode: gh-proxy
    toolsets: [default]
  bash: ["*"]
---

## Shared Rig Loader

Prepare the repository before running rig workflows:

1. Run `npm ci` at `/home/runner/work/rig/rig`.
2. Confirm `skills/rig/rig.ts` exists.
3. Stop immediately if dependency installation fails.
