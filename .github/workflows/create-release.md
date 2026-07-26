---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests), then has the AI agent
  compute the next semver version from the latest git tag and the requested bump
  type (patch/minor/major), summarize commits, and publish a draft GitHub release.
on:
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
safe-outputs:
  jobs:
    create-release:
      description: "Push a git tag and create a GitHub release with the AI-generated notes"
      runs-on: ubuntu-latest
      inputs:
        version:
          description: "Computed version without the v prefix (e.g. 1.2.3)"
          required: true
          type: string
        body:
          description: "Release description in GitHub-flavored markdown"
          required: true
          type: string
        draft:
          description: "Publish as a draft release for manual review before going live"
          type: boolean
      permissions:
        contents: write
      steps:
        - uses: actions/checkout@v7
          with:
            fetch-depth: 0
        - name: Create tag and release
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            VERSION=$(jq -r 'first(.items[] | select(.type == "create_release")) | .version' "$GH_AW_AGENT_OUTPUT")
            DRAFT=$(jq -r 'first(.items[] | select(.type == "create_release")) | .draft // true' "$GH_AW_AGENT_OUTPUT")
            jq -r 'first(.items[] | select(.type == "create_release")) | .body' "$GH_AW_AGENT_OUTPUT" > /tmp/release-body.md
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git fetch --tags
            git tag "v${VERSION}"
            git push origin "v${VERSION}"
            DRAFT_FLAG=""
            if [ "$DRAFT" = "true" ]; then DRAFT_FLAG="--draft"; fi
            gh release create "v${VERSION}" \
              --title "v${VERSION}" \
              --notes-file /tmp/release-body.md \
              $DRAFT_FLAG
---

## Task

You are preparing a **${{ github.event.inputs.bump }}** release.

The build has already passed. Your job is to compute the next version, summarize what changed since the previous release, and create the draft release.

### Step 1 — Compute the next version

```bash
git fetch --tags
LATEST_TAG=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | head -n 1)
```

Treat an empty `LATEST_TAG` as `v0.0.0`. Parse its major, minor, and patch
components and apply the requested **${{ github.event.inputs.bump }}** bump to
compute the next version.

### Step 2 — Gather commits since the previous release

If a previous tag exists, list commits after it:

```bash
git log "${LATEST_TAG}..HEAD" --oneline
```

Otherwise, list all commits:

```bash
git log --oneline
```

### Step 3 — Read package metadata

```bash
cat package.json
```

Use the package name and description to add context to the release notes.

### Step 4 — Categorize the commits

Group commits into the following categories (omit empty ones):

- **Breaking changes** — commits with `!` or `BREAKING CHANGE` in the message
- **New features** — commits starting with `feat:` or describing new capabilities
- **Bug fixes** — commits starting with `fix:` or describing corrections
- **Improvements** — commits starting with `refactor:`, `perf:`, or describing enhancements
- **Documentation** — commits starting with `docs:`
- **Internal** — chores, tests, and CI changes (summarize briefly, do not list individually)

### Step 5 — Create the release

Call the `create_release` tool with:

- `version`: The computed next version without the `v` prefix
- `draft`: `true`
- `body`: A GitHub-flavored markdown release description with:
  - A short summary paragraph
  - Categorized change lists using `###` headings
  - Breaking changes prominently at the top if any exist
  - Upgrade instructions only if the release contains breaking changes

Call `noop` if the commit list is empty or if the computed next version tag already exists.
