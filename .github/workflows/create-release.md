---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests), computes the next semver
  version from the latest git tag and the requested bump type (patch/minor/major),
  creates a draft GitHub release, then has the AI agent summarize commits and
  update the release with proper notes.
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
safe-outputs:
  jobs:
    update-release:
      description: "Update the draft GitHub release with AI-generated release notes"
      runs-on: ubuntu-latest
      inputs:
        tag_name:
          description: "Release tag name (e.g. v1.2.3)"
          required: true
          type: string
        body:
          description: "Release notes in GitHub-flavored markdown"
          required: true
          type: string
      permissions:
        contents: write
      steps:
        - uses: actions/checkout@v7
          with:
            fetch-depth: 0
        - name: Update release notes
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            TAG_NAME=$(jq -r 'first(.items[] | select(.type == "update_release")) | .tag_name' "$GH_AW_AGENT_OUTPUT")
            jq -r 'first(.items[] | select(.type == "update_release")) | .body' "$GH_AW_AGENT_OUTPUT" > /tmp/release-body.md
            gh release edit "${TAG_NAME}" \
              --notes-file /tmp/release-body.md \
              --draft=false
---

## Task

The build job has already:
- run `npm ci`, `npm run typecheck`, and `npm test`
- computed the next semver version (a **${{ github.event.inputs.bump }}** bump)
- pushed a git tag and created a draft GitHub release

Your job is to write proper release notes and update that draft release.

### Step 1 — Find the tagged release version

```bash
git describe --tags --abbrev=0
```

### Step 2 — Find the previous release tag

```bash
git describe --tags --abbrev=0 HEAD^
```

If no previous tag exists, use `v0.0.0` as the base.

### Step 3 — Gather commits since the previous release

```bash
git log <previous-tag>..HEAD --oneline
```

If the previous tag was `v0.0.0` (no prior release), list all commits instead:

```bash
git log --oneline
```

### Step 4 — Read package metadata

```bash
cat package.json
```

Use the package name and description to add context to the release notes.

### Step 5 — Categorize the commits

Group commits into the following categories (omit empty ones):

- **Breaking changes** — commits with `!` or `BREAKING CHANGE` in the message
- **New features** — commits starting with `feat:` or describing new capabilities
- **Bug fixes** — commits starting with `fix:` or describing corrections
- **Improvements** — commits starting with `refactor:`, `perf:`, or describing enhancements
- **Documentation** — commits starting with `docs:`
- **Internal** — chores, tests, and CI changes (summarize briefly, do not list individually)

### Step 6 — Update the release

Call the `update_release` tool with:

- `tag_name`: the tag found in Step 1 (e.g. `v1.2.3`)
- `body`: A GitHub-flavored markdown release description with:
  - A short summary paragraph
  - Categorized change lists using `###` headings
  - Breaking changes prominently at the top if any exist
  - Upgrade instructions only if the release contains breaking changes

Call `noop` if the commit list is empty or if no draft release exists for the current tag.
