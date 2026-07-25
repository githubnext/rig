# 116 - Barrel File Generator

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: generate barrel index.ts files for TypeScript source directories.
const barrelFileGenerator = agent({
  model: "mini",
  input: s.object({
    srcDir: s.path,
  }),
  instructions: p`Generate barrel index.ts files for TypeScript source directories.

Source files found (excluding index.ts):
${p.bash("find . -name '*.ts' ! -name 'index.ts' ! -name '*.test.ts' ! -name '*.spec.ts' -not -path '*/node_modules/*' 2>/dev/null | head -100")}

Use the classifyExports tool to identify exported symbols in files. Then generate barrel
content for each directory that has exported symbols. Write each barrel file using p.write.

Count the total number of files scanned, barrel files that would be written, export count,
and directories involved. Return only the declared output.`,
  tools: [
    defineTool("classifyExports", {
      description: "Scan a TypeScript file path and detect export patterns",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const { execSync } = await import("node:child_process");
        try {
          const out = execSync(`grep -n "^export " "${filePath}" 2>/dev/null || true`, { encoding: "utf-8" });
          return { filePath, exportLines: out.trim().split("\n").filter(Boolean).length };
        } catch {
          return { filePath, exportLines: 0 };
        }
      },
    }),
  ],
  output: s.object({
    filesScanned: s.int,
    barrelFilesWritten: s.int,
    exportCount: s.int,
    directories: s.array(s.string),
  }),
});

export default barrelFileGenerator;
```
