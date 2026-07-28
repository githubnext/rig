# 288 - TS Literal Union Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";

const extractLiteralUnions = defineTool("extractLiteralUnions", {
  description: "Extract string literal union type declarations from a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const re = /type\s+(\w+)\s*=\s*((?:'[^']*'|"[^"]*")(?:\s*\|\s*(?:'[^']*'|"[^"]*"))+)/g;
      const results: Record<string, { members: string[]; memberCount: number; isStringLiteral: boolean }> = {};
      for (const m of content.matchAll(re)) {
        const name = m[1] as string;
        const members = (m[2] as string).split("|").map((v: string) => v.trim().replace(/^['"]|['"]$/g, ""));
        results[name] = { members, memberCount: members.length, isStringLiteral: true };
      }
      return results;
    } catch {
      return {};
    }
  },
});

// Agent role: extract all string literal union type declarations from TypeScript files.
const tsLiteralUnionExtractor = agent({
  model: "small",
  addons: steering({ message: "Call extractLiteralUnions for each file path; merge results across all files." }),
  instructions: p`Extract string literal union type declarations from all TypeScript source files.

TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -40")}

For each file path above, call extractLiteralUnions to get its literal union types. Merge all results into a single record keyed by type name with members, memberCount, and isStringLiteral.`,
  tools: [extractLiteralUnions],
  output: s.record(
    s.object({
      members: s.array(s.string),
      memberCount: s.int,
      isStringLiteral: s.boolean,
    })
  ),
});

export default tsLiteralUnionExtractor;
```
