# 513 - Json Repair Addon Demo

```rig
import { agent, p, s, repair } from "rig";

// Agent role: analyze the README text and produce a strict structured
// assessment. If the model's first response is not valid JSON matching the
// output schema, the repair() addon automatically re-prompts the model with
// the validation error and asks it to fix the output, consuming additional
// turns from maxTurns until it succeeds or the budget is exhausted.
const analyzeReadme = agent({
  model: "small",
  maxTurns: 6,
  instructions: p`Analyze the following text and return a strict JSON object
matching the declared schema: a one-sentence summary, a quality score from
0 to 10, and a list of relevant topic tags.

Text:
${p.read("README.md")}`,
  output: s.object({
    summary: s.string,
    score: s.number,
    tags: s.array(s.string),
  }),
  addons: [repair()],
});

export default analyzeReadme;
```
