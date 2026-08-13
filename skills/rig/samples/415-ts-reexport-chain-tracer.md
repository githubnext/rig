# 415 - TS Reexport Chain Tracer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: trace TypeScript re-export chains from an entry file.
const tsReexportChainTracer = agent({
  model: "small",
  input: s.object({ entryFile: s.path }),
  instructions: p`Trace TypeScript re-export chains starting from the entry file.
Use traceReexports to follow export * from and export { X } from chains.
Detect circular references. Produce the declared output.`,
  tools: [
    defineTool("traceReexports", {
      description: "Read a TypeScript file and extract its re-export paths",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        try {
          const content = await readFile(filePath, "utf-8");
          const regex = /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
          const exports: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) exports.push(m[1]);
          return { filePath, reexports: exports };
        } catch {
          return { filePath, reexports: [] };
        }
      },
    }),
  ],
  output: s.object({
    chain: s.array(s.object({ file: s.path, symbols: s.array(s.string) })),
    chainDepth: s.int,
    circularDetected: s.boolean,
  }),
  maxTurns: 6,
  addons: [repair()],
});

export default tsReexportChainTracer;

```
