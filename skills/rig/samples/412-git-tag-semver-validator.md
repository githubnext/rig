# 412 - Git Tag Semver Validator

```rig
import { agent, p, s, defineTool, steering } from "rig";

const validateSemver = defineTool("validateSemver", {
  description: "Validate a git tag against semver format and classify it",
  parameters: s.object({ tag: s.string }),
  handler: ({ tag }: { tag: string }) => {
    const releaseRe = /^\d+\.\d+\.\d+$/;
    const prereleaseRe = /^\d+\.\d+\.\d+-.+$/;
    if (releaseRe.test(tag)) {
      return { valid: true, normalized: tag, type: "release" as const };
    } else if (prereleaseRe.test(tag)) {
      return { valid: true, normalized: tag, type: "prerelease" as const };
    }
    // strip leading 'v' and retry
    const stripped = tag.replace(/^v/, "");
    if (releaseRe.test(stripped)) {
      return { valid: true, normalized: stripped, type: "release" as const };
    } else if (prereleaseRe.test(stripped)) {
      return { valid: true, normalized: stripped, type: "prerelease" as const };
    }
    return { valid: false, normalized: tag, type: "invalid" as const };
  },
});

// Agent role: Validate all git tags in the repository against semver format and produce a validity report.
const gitTagSemverValidator = agent({
  model: "small",
  instructions: p`Validate all git tags against semver format.
Git tags: ${p.bash("git tag --list")}
Use the validateSemver tool on each tag.
Return an object with:
- tags: array of objects each with { tag, valid, normalized, type }
- validCount: number of valid tags
- invalidCount: number of invalid tags
- allValid: true if invalidCount is 0`,
  output: s.object({
    tags: s.array(s.object({
      tag: s.string,
      valid: s.boolean,
      normalized: s.string,
      type: s.enum("release", "prerelease", "invalid"),
    })),
    validCount: s.int,
    invalidCount: s.int,
    allValid: s.boolean,
  }),
  tools: [validateSemver],
  addons: [steering()],
});

export default gitTagSemverValidator;
```
