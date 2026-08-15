# 411 - TypeScript Async Function Finder V2

```rig
import { agent, p, s, steering, defineTool } from "rig";

const scanAsyncFunctions = defineTool("scanAsyncFunctions", {
  description: "Scan a TypeScript file for async function signatures.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const asyncFunctions: string[] = [];
    const re = /async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\s*(?:\([^)]*\)|[^=]+)\s*=>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1] ?? m[2];
      if (name) asyncFunctions.push(name);
    }
    return { asyncFunctions, count: asyncFunctions.length };
  },
});

// Agent role: Scan TypeScript source files to find all async function signatures and report statistics.
const tsAsyncFunctionFinderV2 = agent({
  model: "small",
  instructions: p`TypeScript files in this workspace:
${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -20")}

For each file path, call the scanAsyncFunctions tool. Aggregate results into a record keyed by file path. Return totalAsync as the total count and mostAsyncFile as the path with the most async functions.`,
  tools: [scanAsyncFunctions],
  maxTurns: 6,
  output: s.object({
    files: s.record(s.object({ asyncFunctions: s.array(s.string), count: s.int })),
    totalAsync: s.int,
    mostAsyncFile: s.optional(s.string),
  }),
  addons: [steering()],
});

export default tsAsyncFunctionFinderV2;

```
