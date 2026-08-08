# 380 - TypeScript String Literal Unions

```rig
import { agent, defineTool, p, s, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractStringLiteralUnions = defineTool("extractStringLiteralUnions", {
  description: "Extract string literal union type aliases from a TypeScript file",
  parameters: s.object({ filePath: s.string("path to TypeScript file") }),
  async handler({ filePath }) {
    try {
      const src = await readFile(filePath, "utf8");
      const pattern = /type\s+(\w+)\s*=\s*((?:'[^']*'|"[^"]*")\s*(?:\|\s*(?:'[^']*'|"[^"]*")\s*)+);/g;
      const results: Record<string, string[]> = {};
      for (const m of src.matchAll(pattern)) {
        const name = m[1];
        const valueStr = m[2];
        const values = [...valueStr.matchAll(/['"]([^'"]+)['"]/g)].map((v) => v[1]);
        if (values.length > 0) results[name] = values;
      }
      return JSON.stringify(results);
    } catch {
      return "{}";
    }
  },
});

// Agent role: extract all string literal union type aliases from TypeScript source files.
const stringLiteralUnionExtractor = agent({
  model: "small",
  maxTurns: 5,
  instructions: p`Extract string literal union types from TypeScript files.

TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path above, call extractStringLiteralUnions to find type aliases that are string literal unions (e.g., type Status = 'active' | 'inactive'). Collect all results, count total types and total values, and identify the largest union by value count.

Return the output schema.`,
  output: s.object({
    types: s.record(s.array(s.string)),
    totalTypes: s.int,
    totalValues: s.int,
    largestUnion: s.optional(s.string),
  }),
  tools: [extractStringLiteralUnions],
  addons: [steering()],
});

export default stringLiteralUnionExtractor;
```
