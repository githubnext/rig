# 228 - Circular Import Detector

```rig
import { agent, defineTool, p, s, steering } from "rig";

const buildImportGraph = defineTool("buildImportGraph", {
  description: "Build an import graph from TypeScript files in a directory by parsing relative import statements",
  parameters: s.object({ directory: s.path }),
  async handler({ directory }) {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const graph: Record<string, string[]> = {};
    try {
      const entries = await readdir(directory, { recursive: true, encoding: "utf-8" });
      const tsFiles = entries.filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"));
      for (const file of tsFiles.slice(0, 20)) {
        const fullPath = join(directory, file);
        try {
          const content = await readFile(fullPath, "utf-8");
          const imports = [...content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map(m => m[1]);
          graph[file] = imports;
        } catch {
          graph[file] = [];
        }
      }
    } catch {
      // directory not found
    }
    return { graph };
  },
});

// Agent role: detect circular imports in TypeScript source files.
const circularImportDetector = agent({
  model: "small",
  addons: steering(),
  instructions: p`Detect circular imports in TypeScript files.

Import overview:
${p.bash("grep -rn \"from '\\./\\|from \\\"\\./\" src/ --include='*.ts' 2>/dev/null | head -40 || grep -rn \"from '\\./\" . --include='*.ts' | grep -v node_modules | head -40 || echo 'no relative imports found'")}

Call buildImportGraph on the source directory (try "src" first, then "."). Analyse the graph to find cycles (A imports B imports A, etc.). Return cycles as arrays of file paths, hasCycles, totalFiles, and cycleCount.`,
  tools: [buildImportGraph],
  output: s.object({
    cycles: s.array(s.array(s.string)),
    hasCycles: s.boolean,
    totalFiles: s.int,
    cycleCount: s.int,
  }),
});

export default circularImportDetector;
```
