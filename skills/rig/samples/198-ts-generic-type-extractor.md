# 198 - Ts Generic Type Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractGenerics = defineTool("extractGenerics", {
  description: "Extract TypeScript generic type parameters from a source file",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8").catch(() => "");
    const matches = content.match(/<[A-Z][A-Za-z]*(?:,\s*[A-Z][A-Za-z]*)*>/g) ?? [];
    return { generics: [...new Set(matches)], count: matches.length };
  },
});

// Agent role: scan TypeScript files for generic type parameters and classify complexity.
const tsGenericTypeExtractor = agent({
  model: "small",
  instructions: p`Find all TypeScript files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -50")}. For each file, use extractGenerics to find generic type parameters. Classify complexity: none (0 generics), simple (1–2), moderate (3–5), complex (6+).`,
  output: s.record(s.object({
    generics: s.array(s.string),
    count: s.int,
    complexity: s.enum("none", "simple", "moderate", "complex"),
  })),
  tools: [extractGenerics],
  maxTurns: 5,
  addons: repair(),
});

export default tsGenericTypeExtractor;
```
