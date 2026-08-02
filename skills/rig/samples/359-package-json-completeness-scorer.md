# 359 - Package JSON Completeness Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const scoreField = defineTool("scoreField", {
  description: "Score a package.json field for completeness and return its category.",
  parameters: { fieldName: s.string, value: s.unknown },
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

package.json content:
${p.read("package.json")}

The required fields are: name, version.
The recommended fields are: description, main, scripts, license, repository, keywords.
The optional fields are: author, bugs, homepage, engines, files, types.

Steps:
1. For each field name from all three categories, call scoreField with the fieldName and its value from package.json (or undefined if absent).
2. Build a fields record keyed by fieldName with present, category, and score.
3. totalScore = sum of all score values. maxScore = total number of fields checked.
4. completenessPercent = (totalScore / maxScore) * 100.
5. missingRequired = required fields where present is false.`,
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
