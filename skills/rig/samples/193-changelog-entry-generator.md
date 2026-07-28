# 193 - Changelog Entry Generator

```rig
import { agent, defineTool, p, s, repair } from "rig";

const validateBumpType = defineTool("validateBumpType", {
  description: "Validate that a semver bump type is major, minor, or patch",
  parameters: s.object({ bumpType: s.string }),
  handler: ({ bumpType }) => { const v = /^(major|minor|patch)$/.test(bumpType); return { valid: v, reason: v ? "ok" : `expected major|minor|patch, got: ${bumpType}` }; },
});
// Agent role: generate a structured changelog entry from the current git diff.
const changelogEntryGenerator = agent({
  model: "small",
  instructions: p`Generate a changelog entry from this diff: ${p.bash("git diff HEAD")}
Categorize into added, fixed, changed, breaking. Validate bumpType with validateBumpType.
Latest tag: ${p.bash("git describe --tags --abbrev=0 2>/dev/null || echo '0.0.0'")}
Write a human-readable entry in "entry". ${p.writeOutput("entry", "CHANGELOG_ENTRY.md")}`,
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
