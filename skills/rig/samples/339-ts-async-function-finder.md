# 339 - TS Async Function Finder

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const scanAsyncFunctions = defineTool("scanAsyncFunctions", {
  description: "Find async function and method signatures in a TypeScript file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const src = await readFile(filePath, "utf-8");
    const matches = src.match(/async\s+(?:function\s+(\w+)|\*?\s*(\w+)\s*\()/g) ?? [];
    const asyncFunctions = matches.map((m: string) => m.trim());
    return { asyncFunctions, count: asyncFunctions.length };
  },
});

// Agent role: scan TypeScript files for async functions and return per-file counts with totals.
const tsAsyncFunctionFinder = agent({
  model: "small",
  instructions: p`TypeScript files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -40")}
Call scanAsyncFunctions for each file. Return files record, totalAsync, and mostAsyncFile.`,
  output: s.object({
    files: s.record(s.object({
      asyncFunctions: s.array(s.string),
      count: s.int,
    })),
    totalAsync: s.int,
    mostAsyncFile: s.optional(s.path),
  }),
  tools: [scanAsyncFunctions],
  addons: [steering()],
  maxTurns: 8,
});

export default tsAsyncFunctionFinder;
```
