# 389 - TS Complexity Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scoreFileComplexity = defineTool("scoreFileComplexity", {
  description: "Score the complexity of a TypeScript file by counting nesting, ternaries, and callbacks",
  parameters: s.object({
    filePath: s.path,
  }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const ternaries = (content.match(/\?[^?:]/g) ?? []).length;
    const callbacks = (content.match(/=>\s*{/g) ?? []).length;
    let maxNesting = 0;
    let nesting = 0;
    for (const ch of content) {
      if (ch === "{") nesting++;
      else if (ch === "}") nesting--;
      if (nesting > maxNesting) maxNesting = nesting;
    }
    const score = ternaries * 1.5 + callbacks * 2 + maxNesting * 0.5;
    const complexity = score > 30 ? "high" as const : score > 15 ? "medium" as const : "low" as const;
    const topContributors: string[] = [];
    if (callbacks > 5) topContributors.push("callbacks");
    if (ternaries > 5) topContributors.push("ternaries");
    if (maxNesting > 8) topContributors.push("deep-nesting");
    return { score, complexity, topContributors };
  },
});

// Agent role: Score TypeScript files by complexity metrics and identify the most complex file.
const tsComplexityScorer = agent({
  model: "small",
  instructions: p`You are a TypeScript complexity scorer.
TypeScript source files: ${p.glob("src/**/*.ts")}

For each file, call scoreFileComplexity to get a score and complexity rating.
Compute the average score across all files.
Identify the most complex file.
Return the output schema.`,
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
