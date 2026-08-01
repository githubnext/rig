# 349 - TS Generic Constraint Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Find TypeScript generic type parameters with extends constraints across all .ts files.
const tsGenericConstraintExtractor = agent({
  model: "small",
  instructions: p`You are a TypeScript generic constraint extractor.

TypeScript files found:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -30")}

${defineTool("extractGenericConstraints", {
  description: "Extract generic type parameter constraints from a TypeScript file",
  parameters: s.object({ filePath: s.string }),
  handler: async (args) => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(args.filePath, "utf8");
    const matches = [...src.matchAll(/<([A-Z][a-zA-Z]*)\s+extends\s+([^,>]+)/g)];
    return {
      constraints: matches.map((m) => ({
        typeParam: m[1],
        constraint: m[2].trim(),
      })),
      count: matches.length,
    };
  },
})}

Scan each TypeScript file for generic constraints, aggregate by file, and return the structured result.`,
  output: s.object({
    constraints: s.record(s.array(s.string)),
    totalConstraints: s.int,
    constrainedCount: s.int,
    mostConstrainedFile: s.optional(s.string),
  }),
  addons: [repair()],
});

export default tsGenericConstraintExtractor;
```
