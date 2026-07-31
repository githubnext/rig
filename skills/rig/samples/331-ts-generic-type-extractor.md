# 331 - TS Generic Type Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractGenerics = defineTool("extractGenerics", {
  description: "Extract generic type parameters from a TypeScript file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const src = await readFile(filePath, "utf-8");
    const matches = src.match(/<[A-Z][A-Za-z0-9, ]*>/g) ?? [];
    const generics = [...new Set(matches.map((m: string) => m.slice(1, -1).trim()))];
    const count = generics.length;
    const complexity =
      count === 0 ? "none" as const
      : count <= 2 ? "simple" as const
      : count <= 5 ? "moderate" as const
      : "complex" as const;
    return { generics, count, complexity };
  },
});

// Agent role: find TypeScript files and extract generic type parameters, classifying complexity per file.
const tsGenericTypeExtractor = agent({
  model: "small",
  instructions: p`TypeScript files found: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -30")}
For each file, call extractGenerics to get its generic types and return the results keyed by filename.`,
  output: s.record(s.object({
    generics: s.array(s.string),
    count: s.int,
    complexity: s.enum("none", "simple", "moderate", "complex"),
  })),
  tools: [extractGenerics],
  addons: [repair()],
  maxTurns: 6,
});

export default tsGenericTypeExtractor;
```
