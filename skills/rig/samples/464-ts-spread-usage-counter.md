# 464 - TypeScript Spread Usage Counter

```rig
import { agent, defineTool, p, s, steering } from "rig";


const countSpreadPatterns = defineTool("countSpreadPatterns", {
  description: "Count object spread and array spread usages in a TypeScript file.",
  parameters: s.object({ filePath: s.path("TypeScript file path") }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(filePath, "utf8");
    const objectSpreads = (src.match(/\.\.\.[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*[,}])/g) ?? []).length;
    const arraySpreads = (src.match(/\.\.\.[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*[,\]])/g) ?? []).length;
    return JSON.stringify({ objectSpreads, arraySpreads });
  },
});

// Agent role: count object spread and array spread patterns across all TypeScript source files.
const tsSpreadUsageCounter = agent({
  name: "tsSpreadUsageCounter",
  model: "small",
  instructions: p`Scan all TypeScript source files for spread operator usage.
Files: ${p.glob("src/**/*.ts")}
Use countSpreadPatterns on each file. Aggregate into:
- files: record mapping filePath to { objectSpreadCount, arraySpreadCount }
- totalObjectSpreads: sum of all object spreads
- totalArraySpreads: sum of all array spreads
- mostSpreadFile: path of the file with the highest combined spread count (null if none)`,
  output: s.object({
    files: s.record(s.object({ objectSpreadCount: s.int, arraySpreadCount: s.int })),
    totalObjectSpreads: s.int,
    totalArraySpreads: s.int,
    mostSpreadFile: s.optional(s.path),
  }),
  tools: [countSpreadPatterns],
  addons: [steering()],
});

export default tsSpreadUsageCounter;
```
