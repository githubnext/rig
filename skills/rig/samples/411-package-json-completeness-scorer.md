# 411 - Package Json Completeness Scorer

```rig
import { agent, defineTool, p, repair, s } from "rig";

const scoreField = defineTool("scoreField", {
  description: "Score a package.json field for completeness and return its category.",
  parameters: s.object({ fieldName: s.string, value: s.unknown }),
  handler: ({ fieldName, value }: { fieldName: string; value: unknown }) => {
    const required = ["name", "version"];
    const recommended = ["description", "main", "scripts", "license", "repository", "keywords"];
    const category = required.includes(fieldName)
      ? ("required" as const)
      : recommended.includes(fieldName)
        ? ("recommended" as const)
        : ("optional" as const);
    const present = value !== undefined && value !== null && value !== "";
    const score = present ? 1 : 0;
    return { present, category, score };
  },
});

// Agent role: score the completeness of package.json against required and recommended fields.
const packageJsonCompletenessScorer = agent({
  model: "small",
  instructions: p`Score the completeness of package.json.

Content:
${p.read("package.json")}

Required fields: name, version.
Recommended fields: description, main, scripts, license, repository, keywords.
Optional fields: author, bugs, homepage, engines, files, types.

For each field from all three categories, call scoreField with fieldName and value (or undefined if absent).
Build fields record. totalScore = sum of scores. maxScore = total fields. completenessPercent = (totalScore / maxScore) * 100. missingRequired = required fields where present is false.`,
  output: s.object({
    fields: s.record(s.object({
      present: s.boolean,
      category: s.enum("required", "recommended", "optional"),
      score: s.number,
    })),
    totalScore: s.number,
    maxScore: s.number,
    completenessPercent: s.number,
    missingRequired: s.array(s.string),
  }),
  tools: [scoreField],
  addons: [repair()],
});

export default packageJsonCompletenessScorer;
```
