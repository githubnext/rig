import { agent, defineTool, p, s, repair } from "rig";

const scoreField = defineTool("scoreField", {
  description: "Score a package.json field for presence, completeness, and quality",
  parameters: s.object({
    fieldName: s.string,
    value: s.unknown,
    importance: s.enum("required", "recommended", "optional"),
  }),
  handler({ fieldName, value, importance }) {
    const present = value !== undefined && value !== null && value !== "";
    const nonEmpty = present && (typeof value !== "object" || Object.keys(value as object).length > 0);
    const score = !present ? 0 : !nonEmpty ? 30 : importance === "required" ? 100 : importance === "recommended" ? 80 : 60;
    const note = !present
      ? `Missing ${importance} field`
      : !nonEmpty
      ? `Field '${fieldName}' is empty`
      : `Field '${fieldName}' is present`;
    return { present, score, note };
  },
});

// Agent role: score a package.json manifest for completeness and produce a grade.
const packageJsonScorer = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Score this package.json for completeness: ${p.read("package.json")}. Use scoreField for each of these fields:
- required: name, version, description, main
- recommended: license, author, repository, keywords, bugs, homepage
- optional: engines, files, exports
Compute an overall score (0-100) as weighted average and assign a grade: A(90+), B(75+), C(60+), D(40+), F(<40). List missingRequired and missingRecommended fields.`,
  tools: [scoreField],
  output: s.object({
    score: s.int,
    grade: s.enum("A", "B", "C", "D", "F"),
    missingRequired: s.array(s.string),
    missingRecommended: s.array(s.string),
    details: s.record(s.object({
      present: s.boolean,
      score: s.int,
      note: s.string,
    })),
  }),
});

export default packageJsonScorer;
