# 432 - Json Pretty Printer Stats

```rig
import { agent, p, s, defineTool } from "rig";

const analyzeJsonStructure = defineTool("analyzeJsonStructure", {
  description: "Parse a JSON string and compute key count, max nesting depth, array count, and object count.",
  parameters: s.object({ json: s.string }),
  handler({ json }: { json: string }) {
    function analyze(val: unknown, depth: number): { totalKeys: number; maxDepth: number; arrayCount: number; objectCount: number } {
      if (Array.isArray(val)) {
        const results = val.map((v: unknown) => analyze(v, depth + 1));
        return {
          totalKeys: results.reduce((a, r) => a + r.totalKeys, 0),
          maxDepth: Math.max(depth, ...results.map(r => r.maxDepth)),
          arrayCount: 1 + results.reduce((a, r) => a + r.arrayCount, 0),
          objectCount: results.reduce((a, r) => a + r.objectCount, 0),
        };
      } else if (val !== null && typeof val === "object") {
        const keys = Object.keys(val as object);
        const results = keys.map(k => analyze((val as Record<string, unknown>)[k], depth + 1));
        return {
          totalKeys: keys.length + results.reduce((a, r) => a + r.totalKeys, 0),
          maxDepth: Math.max(depth, ...results.map(r => r.maxDepth)),
          arrayCount: results.reduce((a, r) => a + r.arrayCount, 0),
          objectCount: 1 + results.reduce((a, r) => a + r.objectCount, 0),
        };
      }
      return { totalKeys: 0, maxDepth: depth, arrayCount: 0, objectCount: 0 };
    }
    try {
      const parsed = JSON.parse(json);
      return analyze(parsed, 0);
    } catch {
      return { totalKeys: 0, maxDepth: 0, arrayCount: 0, objectCount: 0 };
    }
  },
});

// Agent role: pretty-print a JSON file and report structural statistics.
const jsonPrettyPrinterStats = agent({
  model: "small",
  input: s.object({ inputFile: s.path, outputFile: s.optional(s.path) }),
  instructions: p`Pretty-print the JSON file and report structural statistics.

File contents:
${p.readInput("inputFile")}

1. Call analyzeJsonStructure with the raw file content.
2. Parse the JSON and re-serialize it with 2-space indentation as "formatted".
3. If outputFile was provided, set outputWritten to true; otherwise false.
4. Return formatted, stats, and outputWritten.`,
  output: s.object({
    formatted: s.string,
    stats: s.object({
      totalKeys: s.int,
      maxDepth: s.int,
      arrayCount: s.int,
      objectCount: s.int,
    }),
    outputWritten: s.boolean,
  }),
  tools: [analyzeJsonStructure],
});

export default jsonPrettyPrinterStats;
```
