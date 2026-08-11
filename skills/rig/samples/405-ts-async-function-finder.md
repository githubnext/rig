# 405 - Ts Async Function Finder

```rig
import { agent, p, s, steering, defineTool } from "rig";

const scanAsyncFunctions = defineTool("scanAsyncFunctions", {
  description: "Scan a TypeScript file for async function signatures.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const matches: string[] = [];
    const asyncFnRe = /async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\s*(?:\([^)]*\)|[^=]+)\s*=>/g;
    let m: RegExpExecArray | null;
    while ((m = asyncFnRe.exec(content)) !== null) {
      const name = m[1] ?? m[2];
      if (name) matches.push(name);
    }
    return { functions: matches };
  },
});

// Agent role: Find all async function signatures in TypeScript source files.
const tsAsyncFunctionFinder = agent({
  model: "small",
  instructions: p`TypeScript files in this repository:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*'")}

For each file path listed above, call the scanAsyncFunctions tool. Accumulate results into a record keyed by file path with the list of async function names. Return totalAsync (sum of all async functions) and mostAsyncFile (the file with the most async functions).`,
  tools: [scanAsyncFunctions],
  maxTurns: 5,
  output: s.object({
    files: s.record(s.array(s.string)),
    totalAsync: s.int,
    mostAsyncFile: s.optional(s.path),
  }),
  addons: [steering()],
});

export default tsAsyncFunctionFinder;
```
