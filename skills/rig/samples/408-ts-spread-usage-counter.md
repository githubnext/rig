# 408 - Ts Spread Usage Counter

```rig
import { agent, p, s, steering, defineTool } from "rig";

const countSpreadPatterns = defineTool("countSpreadPatterns", {
  description: "Count object spread and array spread usages in a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const objectSpreadCount = (content.match(/\{[^}]*\.\.\./g) ?? []).length;
    const arraySpreadCount = (content.match(/\[[^\]]*\.\.\./g) ?? []).length;
    return { objectSpreadCount, arraySpreadCount };
  },
});

// Agent role: Count TypeScript object spread and array spread patterns across source files.
const tsSpreadUsageCounter = agent({
  model: "small",
  instructions: p`TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path above, call countSpreadPatterns. Return a record keyed by file path with objectSpreadCount and arraySpreadCount, along with totalObjectSpreads, totalArraySpreads, and mostSpreadFile (the file with the highest combined count).`,
  tools: [countSpreadPatterns],
  output: s.object({
    files: s.record(s.object({ objectSpreadCount: s.int, arraySpreadCount: s.int })),
    totalObjectSpreads: s.int,
    totalArraySpreads: s.int,
    mostSpreadFile: s.optional(s.string),
  }),
  addons: [steering()],
});

export default tsSpreadUsageCounter;
```
