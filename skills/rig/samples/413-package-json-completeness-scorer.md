# 413 - Package JSON Completeness Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const scoreField = defineTool("scoreField", {
  description: "Classify a package.json field as required, recommended, or optional and assign a score",
  parameters: s.object({ fieldName: s.string }),
  handler: ({ fieldName }: { fieldName: string }) => {
    const required = ["name", "version", "description", "main", "license"];
    const recommended = ["repository", "keywords", "author", "bugs", "homepage", "engines", "files"];
    if (required.includes(fieldName)) {
      return { category: "required" as const, score: 3 };
    } else if (recommended.includes(fieldName)) {
      return { category: "recommended" as const, score: 2 };
    }
    return { category: "optional" as const, score: 1 };
  },
});

// Agent role: Score package.json completeness by classifying its fields and computing a completeness percentage.
const packageJsonScorer = agent({
  model: "small",
  instructions: p`Score the completeness of package.json.
File contents: ${p.read("package.json")}
Use scoreField on each top-level field present in the file.
Also check for all required/recommended fields that are missing.
Return:
- fields: record mapping each field name to { present: true, category, score }
- For missing required/recommended fields add them with present: false
- totalScore: sum of scores for present fields
- maxScore: sum of all possible scores (required*3 + recommended*2)
- completenessPercent: (totalScore / maxScore) * 100
- missingRequired: array of required field names that are absent`,
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

export default packageJsonScorer;
```
