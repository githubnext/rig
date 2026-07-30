import { agent, p, s, defineTool, repair } from "rig";

const validateSemver = defineTool("validateSemver", {
  description: "Validate that a bump type is major, minor, or patch",
  parameters: s.object({ bump: s.string }),
  handler({ bump }) {
    const valid = ["major", "minor", "patch"].includes(bump);
    return { valid };
  },
});

// Agent role: read recent git changes and produce a structured changelog entry with semver bump classification.
const changelogGenerator = agent({
  model: "typecheck",
  instructions: p`Review ${p.bash("git diff HEAD~1 HEAD --stat")} and ${p.bash("git log HEAD~1..HEAD --oneline")} to produce a changelog entry. Classify each change by category and determine the semver bump type. Use the validateSemver tool to confirm the bump value. Write the markdown changelog to CHANGELOG.md via ${p.write("CHANGELOG.md", "<!-- changelog -->")}`,
  output: s.object({
    version: s.string,
    bump: s.enum("major", "minor", "patch"),
    entries: s.array(s.object({
      category: s.enum("feat", "fix", "chore", "docs", "refactor"),
      description: s.string,
    })),
    markdown: s.string,
  }),
  tools: [validateSemver],
  maxTurns: 6,
  addons: repair(),
});

export default changelogGenerator;

