---
emoji: 🚀
name: Create Release
description: >
  On demand, runs the full build (typecheck + tests), then has the AI agent
  summarize recent commits and emit a create_release output that pushes a
  Git tag and publishes a GitHub release with the AI-generated description.
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Release version without the v prefix (e.g. 1.2.3)"
        required: true
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
          description: "Version without the v prefix (e.g. 1.2.3)"
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

You are preparing a release for **v${{ github.event.inputs.version }}**.

The build has already passed (typecheck + tests succeeded in the previous steps). Your job is to summarize what changed since the last release and create the release.

### Step 1 — Find the range of commits

Check the most recent tag:

```bash
git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "none"
```

If a previous tag exists, gather commits since it:

```bash
git log <previous-tag>..HEAD --oneline
```

If no previous tag exists, list all commits:

```bash
git log --oneline
```

### Step 2 — Read key files for context

```bash
cat package.json
```

Use the package name, description, and any other metadata to add context to the release notes.

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

- `version`: `${{ github.event.inputs.version }}`
- `draft`: `true`
- `body`: A GitHub-flavored markdown release description with:
  - A short summary paragraph
  - Categorized change lists using `###` headings
  - Breaking changes prominently at the top if any exist
  - Installation / upgrade instructions only if there are breaking changes

Call `noop` if the git log returned no commits or if a tag `v${{ github.event.inputs.version }}` already exists.
