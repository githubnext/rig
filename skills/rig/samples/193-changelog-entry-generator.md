# 193 - Changelog Entry Generator

```rig
import { agent, defineTool, p, s, repair } from "rig";

const validateBumpType = defineTool("validateBumpType", {
  description: "Validate that a semver bump type is major, minor, or patch",
  parameters: s.object({ bumpType: s.string }),
  handler({ bumpType }) {
    const valid = /^(major|minor|patch)$/.test(bumpType);
    return { valid, reason: valid ? "Valid bump type" : `Expected major|minor|patch, got: ${bumpType}` };
  },
});

// Agent role: generate a structured changelog entry from the current git diff.
const changelogEntryGenerator = agent({
  model: "small",
  instructions: p`You are a changelog entry generator.

Current git diff:
${p.bash("git diff HEAD")}

Analyze the diff and categorize changes into added, fixed, changed, and breaking sections.
Determine the semver bump type and validate it with the validateBumpType tool.
Propose the next version based on the most recent git tag:
${p.bash("git describe --tags --abbrev=0 2>/dev/null || echo '0.0.0'")}

Write a human-readable changelog entry in the "entry" field.
${p.writeOutput("entry", "CHANGELOG_ENTRY.md")}`,
  tools: [validateBumpType],
  addons: [repair()],
  output: s.object({
    entry: s.string,
    version: s.string,
    changes: s.object({
      added: s.array(s.string),
      fixed: s.array(s.string),
      changed: s.array(s.string),
      breaking: s.array(s.string),
    }),
    bumpType: s.enum("major", "minor", "patch"),
  }),
});

export default changelogEntryGenerator;
```
