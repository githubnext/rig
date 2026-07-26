# 183 - Changelog Entry Generator

```rig
import { agent, defineTool, p, s } from "rig";

const validateSemverBump = defineTool("validateSemverBump", {
  description: "Validate and classify a semver bump type based on commit message keywords",
  parameters: s.object({ commitMessages: s.string }),
  handler({ commitMessages }) {
    const lower = commitMessages.toLowerCase();
    if (/breaking.change|BREAKING CHANGE/i.test(commitMessages)) return "major";
    if (/^feat[:(]/m.test(lower) || /feature/i.test(lower)) return "minor";
    return "patch";
  },
});

// Agent role: analyze recent git changes, determine semver bump type, and write a changelog entry.
const changelogEntryGenerator = agent({
  model: "small",
  tools: [validateSemverBump],
  instructions: p`Analyze recent git diff: ${p.bash("git diff HEAD~1 HEAD --stat 2>/dev/null || true")} and commit log: ${p.bash("git log HEAD~1..HEAD --oneline 2>/dev/null || echo 'no commits'")}. Use validateSemverBump to determine the bump type. Categorize commits into breaking changes, features, fixes, and chores. Propose a next version string (e.g. 1.2.3). Write the changelog entry using ${p.write("CHANGELOG.md", "## [Unreleased]\n")}. Return structured results.`,
  output: s.object({
    bumpType: s.enum("patch", "minor", "major"),
    categories: s.object({
      breaking: s.array(s.string),
      features: s.array(s.string),
      fixes: s.array(s.string),
      chores: s.array(s.string),
    }),
    entryWritten: s.boolean,
    version: s.string,
  }),
});

export default changelogEntryGenerator;
```
