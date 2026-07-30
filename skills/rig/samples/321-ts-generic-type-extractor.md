# 321 - TypeScript Generic Type Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: scan TypeScript files to extract and classify generic type parameters used in each file.
const tsGenericTypeExtractor = agent({
  model: "small",
  instructions: p`Find all TypeScript files (excluding node_modules) and extract their generic type parameters.
Files found: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -30")}
For each file use the extractGenerics tool. Return a record keyed by filename.`,
  output: s.record(s.object({
    generics: s.array(s.string),
    count: s.int,
    complexity: s.enum("none", "simple", "moderate", "complex"),
  })),
  tools: [
    defineTool("extractGenerics", {
      description: "Read a TypeScript file and extract generic type parameters using regex",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const matches = content.match(/<[A-Z][A-Za-z0-9]*(?:\s*,\s*[A-Z][A-Za-z0-9]*)*>/g) ?? [];
        const unique = [...new Set(matches)];
        const count = unique.length;
        const complexity = count === 0 ? "none" as const
          : count <= 2 ? "simple" as const
          : count <= 5 ? "moderate" as const
          : "complex" as const;
        return { generics: unique, count, complexity };
      },
    }),
  ],
  addons: [repair()],
});

export default tsGenericTypeExtractor;
```
