import { agent, p, s, steering } from "rig";
import { defineTool } from "rig";

const parseSemver = defineTool("parseSemver", {
  description: "Parse a git tag string and determine if it is valid semver",
  parameters: s.object({ tag: s.string }),
  handler({ tag }) {
    const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!match) return { valid: false };
    return {
      valid: true,
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  },
});

// Agent role: validate all git tags against semver format and identify the latest valid tag.
const gitTagSemverValidator = agent({
  model: "typecheck",
  addons: steering({ message: "For tags with date-based or non-semver formats, mark valid as false and omit the parsed field." }),
  tools: [parseSemver],
  instructions: p`List all git tags: ${p.bash("git tag --list 2>/dev/null || true")}. For each tag, call the parseSemver tool to check if it conforms to semver (e.g. v1.2.3 or 1.2.3). Count invalid tags. Identify the latest valid semver tag by finding the highest version number.`,
  output: s.object({
    tags: s.array(s.object({
      tag: s.string,
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
});

export default gitTagSemverValidator;
