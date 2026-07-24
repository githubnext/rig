---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests), computes the next semver
  version from the latest git tag and the requested bump type (patch/minor/major),
  then has the AI agent summarize commits and publish a draft GitHub release.
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
  - name: Compute next version
    id: semver
    env:
      BUMP: ${{ github.event.inputs.bump }}
    run: |
      git fetch --tags
      LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
      CURRENT="${LATEST_TAG#v}"
      IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
      MAJOR=${MAJOR:-0}; MINOR=${MINOR:-0}; PATCH=${PATCH:-0}
      case "$BUMP" in
        major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
        minor) MINOR=$((MINOR+1)); PATCH=0 ;;
        *)     PATCH=$((PATCH+1)) ;;
      esac
      NEXT="${MAJOR}.${MINOR}.${PATCH}"
      echo "next_version=${NEXT}" >> "$GITHUB_OUTPUT"
      echo "previous_tag=${LATEST_TAG}" >> "$GITHUB_OUTPUT"
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

You are preparing release **v${{ steps.semver.outputs.next_version }}**
(a **${{ github.event.inputs.bump }}** bump from `${{ steps.semver.outputs.previous_tag }}`).

The build has already passed. Your job is to summarize what changed since the previous release and create the draft release.

### Step 1 — Gather commits since the previous release

```bash
git log ${{ steps.semver.outputs.previous_tag }}..HEAD --oneline
```

If the previous tag was `v0.0.0` (no prior release), list all commits instead:

```bash
git log --oneline
```

### Step 2 — Read package metadata

```bash
cat package.json
```

Use the package name and description to add context to the release notes.

### Step 3 — Categorize the commits

Group commits into the following categories (omit empty ones):

- **Breaking changes** — commits with `!` or `BREAKING CHANGE` in the message
- **New features** — commits starting with `feat:` or describing new capabilities
- **Bug fixes** — commits starting with `fix:` or describing corrections
- **Improvements** — commits starting with `refactor:`, `perf:`, or describing enhancements
- **Documentation** — commits starting with `docs:`
- **Internal** — chores, tests, and CI changes (summarize briefly, do not list individually)

### Step 4 — Create the release

Call the `create_release` tool with:

- `version`: `${{ steps.semver.outputs.next_version }}`
- `draft`: `true`
- `body`: A GitHub-flavored markdown release description with:
  - A short summary paragraph
  - Categorized change lists using `###` headings
  - Breaking changes prominently at the top if any exist
  - Upgrade instructions only if the release contains breaking changes

Call `noop` if the commit list is empty or if a tag `v${{ steps.semver.outputs.next_version }}` already exists.
