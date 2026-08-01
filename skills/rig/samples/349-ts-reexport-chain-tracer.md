# 349 - TS Reexport Chain Tracer

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const traceReexports = defineTool("traceReexports", {
  description: "Scan a TypeScript file for re-export patterns and return referenced files and symbols",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    let source = "";
    try { source = await readFile(filePath, "utf8"); } catch { return { references: [] }; }
    const starMatches = [...source.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)];
    const namedMatches = [...source.matchAll(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)];
    const references = [
      ...starMatches.map((m) => ({ file: m[1], symbols: ["*"] })),
      ...namedMatches.map((m) => ({ file: m[2], symbols: m[1].split(",").map((s: string) => s.trim()) })),
    ];
    return { references };
  },
});

// Agent role: trace the TypeScript re-export chain starting from an entry file and detect circular re-exports.
const tsReexportChainTracer = agent({
  model: "small",
  input: s.object({ entryFile: s.path }),
  instructions: p`Starting from the entryFile in the input, call traceReexports to discover re-export chains. Follow the chain up to 3 levels deep. Build a list of chain entries (file + symbols). Detect if any file appears more than once in the chain (circularDetected). Report the total chain depth.`,
  output: s.object({
    chain: s.array(s.object({
      file: s.string,
      symbols: s.array(s.string),
    })),
    chainDepth: s.int,
    circularDetected: s.boolean,
  }),
  tools: [traceReexports],
  addons: [steering()],
  maxTurns: 6,
});

export default tsReexportChainTracer;
```
