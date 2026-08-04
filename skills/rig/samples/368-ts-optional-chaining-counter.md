# 368 - TS Optional Chaining Counter

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";
import { steering } from "rig";

const countNullSafetyOperators = defineTool("countNullSafetyOperators", {
  description: "Count optional chaining (?.) and nullish coalescing (??) operators in a TypeScript file.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const optionalChainingCount = (content.match(/\?\./g) ?? []).length;
      const nullishCoalescingCount = (content.match(/\?\?[^=]/g) ?? []).length;
      return { optionalChainingCount, nullishCoalescingCount, total: optionalChainingCount + nullishCoalescingCount };
    } catch {
      return { optionalChainingCount: 0, nullishCoalescingCount: 0, total: 0 };
    }
  },
});

const tsOptionalChainingCounter = agent({
  model: "small",
  instructions: p`Count optional chaining (?.) and nullish coalescing (??) operator usage across TypeScript files.

TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -25")}

Steps:
1. For each file path, call countNullSafetyOperators to get per-file counts.
2. Build files record keyed by file path with optionalChainingCount, nullishCoalescingCount, total.
3. totalOptionalChaining = sum of all optionalChainingCount.
4. totalNullishCoalescing = sum of all nullishCoalescingCount.
5. mostUsedFile = file path with the highest total (omit if all totals are 0).`,
  output: s.object({
    files: s.record(
      s.object({
        optionalChainingCount: s.number,
        nullishCoalescingCount: s.number,
        total: s.number,
      })
    ),
    totalOptionalChaining: s.number,
    totalNullishCoalescing: s.number,
    mostUsedFile: s.optional(s.string),
  }),
  tools: [countNullSafetyOperators],
  addons: [steering()],
});

export default tsOptionalChainingCounter;
```
