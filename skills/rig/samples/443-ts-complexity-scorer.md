# 443 - TS Complexity Scorer

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";
import { repair } from "rig";

const scoreFileComplexity = defineTool("scoreFileComplexity", {
  description: "Score the complexity of a TypeScript file by counting nested braces, ternaries, and callbacks",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const nestedBraces = (content.match(/\{[^{}]*\{/g) ?? []).length;
    const ternaries = (content.match(/\?[^:]+:/g) ?? []).length;
    const callbacks = (content.match(/=>\s*\{/g) ?? []).length;
    const score = nestedBraces + ternaries * 2 + callbacks;
    const complexity = score < 10 ? "low" as const : score < 30 ? "medium" as const : "high" as const;
    const topContributors: string[] = [];
    if (nestedBraces > 0) topContributors.push(`nested braces: ${nestedBraces}`);
    if (ternaries > 0) topContributors.push(`ternaries: ${ternaries}`);
    if (callbacks > 0) topContributors.push(`callbacks: ${callbacks}`);
    return { score, complexity, topContributors };
  },
});

// Agent role: Score the complexity of all TypeScript source files.
const tsComplexityScorer = agent({
  model: "small",
  instructions: p`You have these TypeScript files: ${p.glob("src/**/*.ts")}.
For each file, call scoreFileComplexity to get a complexity score.
Return per-file scores and classifications, the average score, and the most complex file.`,
  output: s.object({
    files: s.record(s.object({
      score: s.number,
      complexity: s.enum("low", "medium", "high"),
      topContributors: s.array(s.string),
    })),
    averageScore: s.number,
    mostComplexFile: s.optional(s.string),
  }),
  tools: [scoreFileComplexity],
  addons: [repair()],
});

export default tsComplexityScorer;
```
