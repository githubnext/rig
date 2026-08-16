# 427 - Ts Wildcard Reexport Detector

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const scanWildcardReexports = defineTool("scanWildcardReexports", {
  description: "Scan a TypeScript file for 'export * from' wildcard re-export patterns.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    try {
      const content = await readFile(filePath, "utf-8");
      const re = /export\s+\*(?:\s+as\s+\w+)?\s+from\s+["']([^"']+)["']/g;
      const targets: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        targets.push(m[1]);
      }
      const hasNamespaceExport = /export\s+\*\s+as\s+\w+/.test(content);
      return { reexportCount: targets.length, targets, hasNamespaceExport };
    } catch {
      return { reexportCount: 0, targets: [], hasNamespaceExport: false };
    }
  },
});

// Agent role: detect wildcard re-export patterns across TypeScript source files.
const tsWildcardReexportDetector = agent({
  model: "small",
  instructions: p`Detect wildcard re-export patterns (export * from ...) in TypeScript files.

TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path, call scanWildcardReexports.
Build files record keyed by file path.
totalReexports = sum of all reexportCount.
totalFiles = number of files processed.
mostReexportedFile = file with highest reexportCount (omit if all are 0).`,
  output: s.object({
    files: s.record(s.object({
      reexportCount: s.int,
      targets: s.array(s.string),
      hasNamespaceExport: s.boolean,
    })),
    totalReexports: s.int,
    totalFiles: s.int,
    mostReexportedFile: s.optional(s.string),
  }),
  tools: [scanWildcardReexports],
  addons: [steering()],
});

export default tsWildcardReexportDetector;
```
