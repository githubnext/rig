# 440 - TypeScript Re-Export Chain Tracer

```rig
import { readFile } from "node:fs/promises";
import { agent, p, s, defineTool, steering } from "rig";

const traceReExports = defineTool("traceReExports", {
  description: "Find all re-export statements in a TypeScript file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const targets: string[] = [];
    const reExportRe = /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = reExportRe.exec(content)) !== null) {
      targets.push(m[1]);
    }
    return { targets };
  },
});

// Agent role: Trace TypeScript re-export chains and report chain depth statistics.
const tsReExportChainTracer = agent({
  name: "ts-reexport-chain-tracer",
  model: "small",
  maxTurns: 6,
  instructions: p`You are a TypeScript re-export chain tracer. Here are the source files:
${p.glob("src/**/*.ts")}

For each file, call traceReExports to find its re-export targets. Return reExports (array of {source, targets} objects), totalChains (number of files with at least one re-export), and deepestChain (max number of re-export targets in a single file).`,
  output: s.object({
    reExports: s.array(s.object({ source: s.path, targets: s.array(s.string) })),
    totalChains: s.int,
    deepestChain: s.int,
  }),
  tools: [traceReExports],
  addons: [steering()],
});

export default tsReExportChainTracer;
```
