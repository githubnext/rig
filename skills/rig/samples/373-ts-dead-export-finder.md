# 373 - TypeScript Dead Export Finder

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";
import { readFile } from "node:fs/promises";

const findUnusedExports = defineTool("findUnusedExports", {
  description: "Find exported symbols in a TypeScript file that are not imported in other files.",
  parameters: { filePath: s.path, allFiles: s.array(s.string) },
  handler: async ({ filePath, allFiles }: { filePath: string; allFiles: string[] }) => {
    const content = await readFile(filePath, "utf-8");
    const exportPattern = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;
    const exported: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = exportPattern.exec(content)) !== null) exported.push(m[1]);
    const unused: string[] = [];
    for (const sym of exported) {
      let found = false;
      for (const other of allFiles) {
        if (other === filePath) continue;
        try {
          const otherContent = await readFile(other, "utf-8");
          if (otherContent.includes(sym)) { found = true; break; }
        } catch { /* skip */ }
      }
      if (!found) unused.push(sym);
    }
    return { unused };
  },
});

// Agent role: find unused TypeScript exports across the codebase.
const tsDeadExportFinder = agent({
  model: "small",
  instructions: p`Find TypeScript exported symbols that are never imported elsewhere.

TypeScript files:
${p.glob("src/**/*.ts")}

All TypeScript files (for cross-reference):
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -100")}

Steps:
1. For each file in the source list, call findUnusedExports with that file and the full allFiles list.
2. Build unusedExports record keyed by file path, value is array of unused symbol names.
3. Omit files with no unused exports.
4. totalUnused = total count of unused symbols across all files.
5. hasDeadCode = totalUnused > 0.`,
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
