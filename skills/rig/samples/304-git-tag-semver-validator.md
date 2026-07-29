# 304 - Git Tag Semver Validator

```rig
import { agent, p, s, defineTool, steering } from "rig";

const parseSemver = defineTool("parseSemver", {
  description: "Parse a git tag to determine if it follows semver and extract components",
  parameters: s.object({ tag: s.string }),
  handler({ tag }) {
    const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return { valid: false };
    return {
      valid: true,
      major: parseInt(match[1] ?? "0", 10),
      minor: parseInt(match[2] ?? "0", 10),
      patch: parseInt(match[3] ?? "0", 10),
    };
  },
});

// Agent role: Validate git tags against semver format and identify the latest valid version.
const gitTagSemverValidator = agent({
  model: "small",
  instructions: p`Validate git tags to check semver compliance.

Git tags:
${p.bash("git tag --list 2>/dev/null | head -30 || echo 'no tags'")}

Use the parseSemver tool on each tag to validate format and extract major/minor/patch.
Identify invalidCount (tags that don't follow semver).
Set latestValid to the highest valid semver tag, or omit if none.
Return the structured output.`,
  output: s.object({
    tags: s.array(s.object({
      name: s.string,
      valid: s.boolean,
      parsed: s.optional(s.object({
        major: s.int,
        minor: s.int,
        patch: s.int,
      })),
    })),
    invalidCount: s.int,
    latestValid: s.optional(s.string),
  }),
  tools: [parseSemver],
  addons: [steering()],
});

export default gitTagSemverValidator;
```
