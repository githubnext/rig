# 494 - Ts Abstract Class Finder

```rig
import { agent, defineTool, p, s } from "rig";

const extractAbstractClass = defineTool("extractAbstractClass", {
  description: "Extract abstract class name and export status from a declaration line",
  parameters: s.object({ filePath: s.path, line: s.int, declaration: s.string }),
  handler({ declaration }) {
    const exported = declaration.trim().startsWith("export");
    const match = declaration.match(/abstract\s+class\s+(\w+)/);
    return { className: match?.[1] ?? "Unknown", isExported: exported };
  },
});

// Agent role: find all TypeScript abstract classes in the source tree and report their export status.
const tsAbstractClassFinder = agent({
  model: "small",
  instructions: p`Search for TypeScript abstract classes using ${p.bash("grep -rn 'abstract class' src/ 2>/dev/null || true")}. Also list source files with ${p.glob("src/**/*.ts")}. Use extractAbstractClass for each match to get the class name and export status. Return the full list.`,
  output: s.object({
    abstractClasses: s.array(s.object({ className: s.string, filePath: s.path, line: s.int, isExported: s.boolean })),
    totalCount: s.int,
    exportedCount: s.int,
  }),
  tools: [extractAbstractClass],
});

export default tsAbstractClassFinder;
```
