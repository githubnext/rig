# 480 - TS Conditional Type Extractor

```rig
import { agent, defineTool, p, repair, s } from "rig";

const extractConditionalTypes = defineTool("extractConditionalTypes", {
  description: "Extract TypeScript conditional type patterns from a source file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    const conditionalPattern = /\w+\s+extends\s+[^?]+\?\s*[^:]+:/g;
    const inferPattern = /infer\s+\w+/g;
    const matches = content.match(conditionalPattern) ?? [];
    const inferMatches = content.match(inferPattern) ?? [];
    const hasInfer = inferMatches.length > 0;
    const distributiveCount = matches.filter((m: string) => /^[A-Z]\s+extends/.test(m)).length;
    return {
      conditionalCount: matches.length,
      hasInfer,
      distributiveCount,
    };
  },
});

// Agent role: scan TypeScript source files for conditional type patterns and summarize usage.
const tsConditionalTypeExtractor = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.glob("src/**/*.ts")}. For each file path, call extractConditionalTypes. Return files as a record keyed by path with conditionalCount, hasInfer, and distributiveCount. Include totalConditionals, totalFiles, and mostComplexFile (path with highest conditionalCount, or omit if none have any).`,
  output: s.object({
    files: s.record(s.object({
      conditionalCount: s.int,
      hasInfer: s.boolean,
      distributiveCount: s.int,
    })),
    totalConditionals: s.int,
    totalFiles: s.int,
    mostComplexFile: s.optional(s.string),
  }),
  tools: [extractConditionalTypes],
  maxTurns: 8,
  addons: repair(),
});

export default tsConditionalTypeExtractor;
```
