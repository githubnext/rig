# 298-ts-dead-export-finder - Ts Dead Export Finder

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";
import { readFile } from "node:fs/promises";

const findUnusedExports = defineTool("findUnusedExports", {
  description: "Find exported symbols in a TypeScript file that are not imported elsewhere",
  parameters: s.object({ filePath: s.path, allFiles: s.array(s.string) }),
  handler: async ({ filePath, allFiles }) => {
    const content = await readFile(filePath, "utf8");
    const exportMatches = [...content.matchAll(/export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g)];
    const exportedNames = exportMatches.map((m: RegExpMatchArray) => m[1]);
    const unusedNames: string[] = [];
    for (const name of exportedNames) {
      let isImported = false;
      for (const other of allFiles) {
        if (other === filePath) continue;
        try {
          const otherContent = await readFile(other, "utf8");
          if (otherContent.includes(name)) { isImported = true; break; }
        } catch { /* skip */ }
      }
      if (!isImported) unusedNames.push(name);
    }
    return unusedNames;
  },
});

// Agent role: find unused TypeScript exports across the src directory
const tsDeadExportFinder = agent({
  model: "small",
  instructions: p`Find potentially dead (unused) TypeScript exports. 
Files with exports: ${p.bash("grep -rl 'export ' src/ --include='*.ts' 2>/dev/null | head -20 || echo 'none'")}
All TS files: ${p.glob("src/**/*.ts")}

Use the findUnusedExports tool for each file that has exports, passing all discovered files. Build a record of unused exports keyed by file path, the total count, and whether dead code was found.`,
  output: s.object({
    unusedExports: s.record(s.array(s.string)),
    totalUnused: s.int,
    hasDeadCode: s.boolean,
  }),
  tools: [findUnusedExports],
  addons: [steering(), repair()],
});

export default tsDeadExportFinder;
```
