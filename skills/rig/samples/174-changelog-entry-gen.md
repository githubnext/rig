# 174 - Changelog Entry Gen

```rig
import { agent, defineTool, p, s } from "rig";

const validateSemverBump = defineTool("validateSemverBump", {
  description: "Validate that a semver bump type string is one of major/minor/patch",
  parameters: s.object({ bumpType: s.string }),
  handler({ bumpType }) {
    const valid = /^(major|minor|patch)$/.test(bumpType);
    return { valid, normalized: valid ? bumpType : "patch" };
  },
});

// Agent role: generate a changelog entry from recent git changes and write it to CHANGELOG.md.
const changelogEntryGen = agent({
  model: "small",
  tools: [validateSemverBump],
  instructions: p`Analyze recent changes: ${p.bash("git diff HEAD~1 HEAD --stat 2>/dev/null || true")} and ${p.bash("git log HEAD~1..HEAD --oneline 2>/dev/null || true")}. Determine the appropriate semver bump type and validate it with the validateSemverBump tool. Categorize commits into breaking changes, features, and fixes. Propose a next version and write a changelog entry to ${p.write("CHANGELOG.md", "## Unreleased\n")}. Return structured output.`,
  output: s.object({
    version: s.string,
    bumpType: s.enum("major", "minor", "patch"),
    changes: s.object({
      breaking: s.array(s.string),
      features: s.array(s.string),
      fixes: s.array(s.string),
    }),
    written: s.boolean,
  }),
});

export default changelogEntryGen;
```
