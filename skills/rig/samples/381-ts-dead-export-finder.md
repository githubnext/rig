# 381 - TS Dead Export Finder

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const findUnusedExports = defineTool("findUnusedExports", {
  description: "Find exported symbols in a TypeScript file that are not imported elsewhere in the codebase",
  parameters: s.object({
    filePath: s.path,
    allFilePaths: s.array(s.path),
  }),
  handler: async ({ filePath, allFilePaths }: { filePath: string; allFilePaths: string[] }) => {
    const content = await readFile(filePath, "utf-8");
    const exportMatches = [...content.matchAll(/^export\s+(?:function|const|class|type|interface|enum)\s+(\w+)/gm)];
    const exportedNames = exportMatches.map((m) => m[1]);

    const unusedNames: string[] = [];
    for (const name of exportedNames) {
      let isImported = false;
      for (const other of allFilePaths) {
        if (other === filePath) continue;
        const otherContent = await readFile(other, "utf-8").catch(() => "");
        if (new RegExp(`\\b${name}\\b`).test(otherContent)) {
          isImported = true;
          break;
        }
      }
      if (!isImported) unusedNames.push(name);
    }
    return unusedNames;
  },
});

// Agent role: Scan TypeScript source files and identify exported symbols that are never imported elsewhere.
const tsDeadExportFinder = agent({
  model: "small",
  instructions: p`You are a dead code analyzer.
Discovered TypeScript files: ${p.glob("src/**/*.ts")}
Also check: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' | head -50")}

For each TypeScript file found, call findUnusedExports with that file path and the full list of all TypeScript file paths.
Aggregate results and return the full output schema.`,
  output: s.object({
    unusedExports: s.record(s.array(s.string)),
    totalUnused: s.int,
    hasDeadCode: s.boolean,
  }),
  tools: [findUnusedExports],
});

export default tsDeadExportFinder;
```
