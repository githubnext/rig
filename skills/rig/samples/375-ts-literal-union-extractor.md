# 375 - Ts Literal Union Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractLiteralUnions = defineTool("extractLiteralUnions", {
  description: "Extract TypeScript string literal type unions from a source file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8");
    const results: Record<string, { members: string[]; memberCount: number; isStringLiteral: boolean }> = {};
    const regex = /type\s+(\w+)\s*=\s*((?:'[^']*'|"[^"]*")\s*(?:\|\s*(?:'[^']*'|"[^"]*")\s*)*)/g;
    for (const match of content.matchAll(regex)) {
      const name = match[1];
      const members = [...match[2].matchAll(/['"]([^'"]+)['"]/g)].map((m: RegExpMatchArray) => m[1]);
      results[name] = { members, memberCount: members.length, isStringLiteral: true };
    }
    return results;
  },
});

// Agent role: Scan TypeScript files to find and catalog all string literal type union definitions.
const tsLiteralUnionExtractor = agent({
  model: "small",
  instructions: p`Find TypeScript files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -30")}. Use extractLiteralUnions on each file to collect all string literal type unions.`,
  output: s.record(s.object({ members: s.array(s.string), memberCount: s.int, isStringLiteral: s.boolean })),
  tools: [extractLiteralUnions],
  addons: [steering()],
});

export default tsLiteralUnionExtractor;
```
