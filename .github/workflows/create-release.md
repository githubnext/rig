---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests), then has the AI agent
  compute the next semver version from the latest git tag, summarize commits,
  and publish a GitHub release.
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
safe-outputs:
  threat-detection: false
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
            jq -r 'first(.items[] | select(.type == "create_release")) | .body' "$GH_AW_AGENT_OUTPUT" > /tmp/release-body.md
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git fetch --tags
            git tag "v${VERSION}"
            git push origin "v${VERSION}"
            gh release create "v${VERSION}" \
              --title "v${VERSION}" \
              --notes-file /tmp/release-body.md
---

## Task

This is a **${{ github.event.inputs.bump }}** release. The build has already passed. Your job is to determine the next version, summarize what changed since the previous release, and create the release.

### Step 1 — Determine the next version

```bash
git fetch --tags
PREVIOUS_TAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' | sort -V | tail -n 1)
if [ -z "$PREVIOUS_TAG" ]; then PREVIOUS_TAG="v0.0.0"; fi
echo "$PREVIOUS_TAG"
```

Note the previous tag printed above. Then compute the next semver version by applying a **${{ github.event.inputs.bump }}** bump:
- `patch`: increment the patch number (e.g. `v1.2.3` → `1.2.4`)
- `minor`: increment the minor number, reset patch (e.g. `v1.2.3` → `1.3.0`)
- `major`: increment the major number, reset minor and patch (e.g. `v1.2.3` → `2.0.0`)

### Step 2 — Gather commits since the previous release

Replace `<previous-tag>` with the tag from Step 1:

```bash
git log <previous-tag>..HEAD --oneline
```

If the previous tag was `v0.0.0` (no prior release), list all commits instead:

```bash
git log --oneline
```

If there are no commits since the previous tag, continue anyway. The version must still be incremented from the latest tag, and the release notes should clearly say there were no code changes since the previous release.

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

- `version`: the computed next version string (without the `v` prefix, e.g. `1.2.4`)
- `body`: A GitHub-flavored markdown release description with:
  - A short summary paragraph
  - Categorized change lists using `###` headings
  - Breaking changes prominently at the top if any exist
  - Upgrade instructions only if the release contains breaking changes
  - A brief note when there were no code changes since the previous release

Call `noop` only if the computed tag already exists locally (`git rev-parse "v<next-version>"`) or on origin (`git ls-remote --tags origin "v<next-version>"`).
