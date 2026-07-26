# 178 - Import Style Checker

```rig
import { agent, p, s } from "rig";
import { defineTool } from "rig";

const classifyStyle = defineTool("classifyStyle", {
  description: "Classify a JS file's module style based on require and import counts",
  parameters: s.object({ requireCount: s.int, importCount: s.int }),
  handler({ requireCount, importCount }) {
    if (requireCount > 0 && importCount > 0) return "mixed";
    if (requireCount > 0) return "cjs";
    if (importCount > 0) return "esm";
    return "unknown";
  },
});

// Agent role: classify each JavaScript file as ESM, CJS, mixed, or unknown module style.
const importStyleChecker = agent({
  model: "small",
  maxTurns: 3,
  tools: [classifyStyle],
  instructions: p`Find JS files: ${p.bash("find . -name '*.js' -not -path '*/node_modules/*' 2>/dev/null | head -30")}. For each file run both grep counts in one call: ${p.bash("find . -name '*.js' -not -path '*/node_modules/*' 2>/dev/null | head -30 | xargs -I{} sh -c 'echo {}:$(grep -c \"require(\" {} 2>/dev/null || echo 0):$(grep -c \"^import \" {} 2>/dev/null || echo 0)'")}. Use classifyStyle tool with the counts for each file. Aggregate summary counts by style.`,
  output: s.object({
    files: s.record(s.object({
      style: s.enum("esm", "cjs", "mixed", "unknown"),
      requireCount: s.int,
      importCount: s.int,
    })),
    summary: s.object({
      esmCount: s.int,
      cjsCount: s.int,
      mixedCount: s.int,
    }),
    totalFiles: s.int,
  }),
});

export default importStyleChecker;
```
