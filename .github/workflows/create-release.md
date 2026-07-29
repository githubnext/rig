---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests + skill validation), then has
  the AI agent compute the next semver version from the latest git tag and publish
  a GitHub release using gh skills publish.
on:
  roles: [admin, maintain]
  workflow_dispatch:
    inputs:
      bump:
        description: "Semver bump type"
        required: true
        type: choice
        options: [patch, minor, major]
        default: patch
permissions:
  contents: read
  actions: read
  issues: read
  pull-requests: read
  copilot-requests: write
strict: true
timeout-minutes: 25
tools:
  github:
    mode: gh-proxy
    toolsets: [default]
  bash: ["*"]
network:
  allowed: [defaults, github, node]
steps:
  - name: Install dependencies
    run: npm ci
  - name: Typecheck
    run: npm run typecheck
  - name: Test
    run: npm test
  - name: Validate skill manifest
    env:
      GH_TOKEN: ${{ github.token }}
    run: gh skills publish --dry-run
safe-outputs:
  threat-detection: false
  jobs:
    create-release:
      description: "Push a git tag and publish a GitHub release using gh skills publish"
      runs-on: ubuntu-latest
      inputs:
        version:
          description: "Computed version without the v prefix (e.g. 1.2.3)"
          required: true
          type: string
      permissions:
        contents: write
      steps:
        - uses: actions/checkout@v7
          with:
            fetch-depth: 0
        - name: Create tag and publish release
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            VERSION=$(jq -r 'first(.items[] | select(.type == "create_release")) | .version' "$GH_AW_AGENT_OUTPUT")
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git fetch --tags
            git tag "v${VERSION}"
            git push origin "v${VERSION}"
            gh skills publish --tag "v${VERSION}"
---

## Task

This is a **${{ github.event.inputs.bump }}** release. The build has already passed. Your job is to determine the next version and create the release.

### Step 1 — Determine the next version

```bash
git fetch --tags
PREVIOUS_TAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' | sort -V | tail -n 1)
if [ -z "$PREVIOUS_TAG" ]; then PREVIOUS_TAG="v0.0.0"; fi
echo "$PREVIOUS_TAG"
```

### Step 2 — Compute the next version

Note the previous tag printed above. Then compute the next semver version by applying a **${{ github.event.inputs.bump }}** bump:
- `patch`: increment the patch number (e.g. `v1.2.3` → `1.2.4`)
- `minor`: increment the minor number, reset patch (e.g. `v1.2.3` → `1.3.0`)
- `major`: increment the major number, reset minor and patch (e.g. `v1.2.3` → `2.0.0`)

### Step 3 — Create the release

Call the `create_release` tool with:

- `version`: the computed next version string (without the `v` prefix, e.g. `1.2.4`)

Call `noop` only if the computed tag already exists locally (`git rev-parse "v<next-version>"`) or on origin (`git ls-remote --tags origin "v<next-version>"`).
