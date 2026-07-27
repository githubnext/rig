# 223 - Barrel File Generator V2

```rig
import { agent, defineTool, p, s } from "rig";

const detectExports = defineTool("detectExports", {
  description: "Detect export declarations in a TypeScript source file",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf-8");
      const exports = (content.match(/^export\s+(default\s+)?(function|class|const|let|var|type|interface|enum)\s+\w+/gm) ?? []);
      return { filePath, exports, exportCount: exports.length };
    } catch {
      return { filePath, exports: [], exportCount: 0 };
    }
  },
});

// Agent role: generate barrel index.ts content for TypeScript source directories.
const barrelFileGenerator = agent({
  model: "small",
  instructions: p`Find TypeScript source files: ${p.bash("find src -name '*.ts' ! -name 'index.ts' ! -name '*.test.ts' ! -name '*.spec.ts' 2>/dev/null | head -30 || find . -name '*.ts' ! -name 'index.ts' ! -name '*.test.ts' ! -path '*/node_modules/*' | head -20")}. Use detectExports for each file. Tally filesScanned, barrelFilesWritten (directories that have at least one export), exportCount (total exports found), and directories (unique directory paths). Return only the declared output.`,
  tools: [detectExports],
  output: s.object({
    filesScanned: s.int,
    barrelFilesWritten: s.int,
    exportCount: s.int,
    directories: s.array(s.string),
  }),
});

export default barrelFileGenerator;
```
