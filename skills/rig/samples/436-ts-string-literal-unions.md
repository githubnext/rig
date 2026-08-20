# 436 - TypeScript String Literal Unions

```rig
import { readFile } from "node:fs/promises";
import { agent, p, s, defineTool, steering } from "rig";

const extractStringLiteralUnions = defineTool("extractStringLiteralUnions", {
  description: "Extract TypeScript string literal union type aliases from a source file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const matches: Record<string, string[]> = {};
    const unionRe = /type\s+(\w+)\s*=\s*((?:'[^']*'|"[^"]*")(?:\s*\|\s*(?:'[^']*'|"[^"]*"))+)/g;
    let m: RegExpExecArray | null;
    while ((m = unionRe.exec(content)) !== null) {
      const name = m[1];
      const values = m[2].match(/'[^']*'|"[^"]*"/g)?.map((v: string) => v.replace(/['"]/g, "")) ?? [];
      matches[name] = values;
    }
    return { unions: matches };
  },
});

// Agent role: Extract all string literal union types from TypeScript source files.
const tsStringLiteralUnionExtractor = agent({
  name: "ts-string-literal-union-extractor",
  model: "small",
  maxTurns: 6,
  instructions: p`You are a TypeScript string literal union extractor. Here are the source files:
${p.glob("src/**/*.ts")}

For each file, call extractStringLiteralUnions. Collect all union types across files. Return types (a record of union name to array of values), totalTypes, totalValues (sum of all values across all unions), and largestUnion (the union name with the most values, if any).`,
  output: s.object({
    types: s.record(s.array(s.string)),
    totalTypes: s.int,
    totalValues: s.int,
    largestUnion: s.optional(s.string),
  }),
  tools: [extractStringLiteralUnions],
  addons: [steering()],
});

export default tsStringLiteralUnionExtractor;
```
