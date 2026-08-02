# 358 - Git Tag Semver Validator V2

```rig
import { agent, p, s, defineTool, steering } from "rig";

const validateSemver = defineTool("validateSemver", {
  description: "Validate a git tag against semver format and classify it.",
  parameters: { tag: s.string },
  handler: ({ tag }: { tag: string }) => {
    const semverRegex = /^v?(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    const m = tag.match(semverRegex);
    if (!m) return { valid: false, normalized: undefined, type: "invalid" as const };
    const normalized = `${m[1]}.${m[2]}.${m[3]}${m[4] ?? ""}`;
    const type = m[4] ? ("prerelease" as const) : ("release" as const);
    return { valid: true, normalized, type };
  },
});

// Agent role: validate all git tags in the repository against semantic versioning format.
const gitTagSemverValidator = agent({
  model: "small",
  instructions: p`Validate all git tags against semver format.

Git tags:
${p.bash("git tag --list 2>/dev/null || echo ''")}

Steps:
1. Parse each line as a tag name (skip empty lines).
2. For each tag, call validateSemver to get valid, normalized, and type.
3. Build the tags array with tag, valid, normalized (omit if invalid), and type.
4. validCount = tags where valid is true; invalidCount = tags where valid is false.
5. allValid = invalidCount === 0.`,
  output: s.object({
    tags: s.array(s.object({
      tag: s.string,
      valid: s.boolean,
      normalized: s.optional(s.string),
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
