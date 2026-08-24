# 453 - TypeScript Complexity Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scoreFileComplexity = defineTool("scoreFileComplexity", {
  description: "Score the complexity of a TypeScript file by counting nested braces, ternaries, and callbacks",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const nestedBraces = (content.match(/\{[^{}]*\{/g) ?? []).length;
    const ternaries = (content.match(/\?[^:]+:/g) ?? []).length;
    const callbacks = (content.match(/=>\s*\{/g) ?? []).length;
    const score = nestedBraces + ternaries * 0.5 + callbacks * 0.5;
    const complexity: "low" | "medium" | "high" = score < 5 ? "low" : score < 15 ? "medium" : "high";
    const topContributors: string[] = [];
    if (nestedBraces > 0) topContributors.push(`nestedBraces:${nestedBraces}`);
    if (ternaries > 0) topContributors.push(`ternaries:${ternaries}`);
    if (callbacks > 0) topContributors.push(`callbacks:${callbacks}`);
    return { score, complexity, topContributors };
  },
});

// Agent role: Score complexity of all TypeScript source files in src/ and return a ranked summary.
const tsComplexityScorer = agent({
  model: "small",
  instructions: p`Score the complexity of these TypeScript files: ${p.glob("src/**/*.ts")}. Call scoreFileComplexity for each file path. Then return the full result.`,
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
