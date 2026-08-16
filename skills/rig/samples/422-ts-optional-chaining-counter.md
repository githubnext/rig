# 422 - Ts Optional Chaining Counter

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const countNullSafetyOperators = defineTool("countNullSafetyOperators", {
  description: "Count optional chaining (?.) and nullish coalescing (??) operators in a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    try {
      const content = await readFile(filePath, "utf-8");
      const optionalChainingCount = (content.match(/\?\./g) ?? []).length;
      const nullishCoalescingCount = (content.match(/\?\?(?!=)/g) ?? []).length;
      return { optionalChainingCount, nullishCoalescingCount, total: optionalChainingCount + nullishCoalescingCount };
    } catch {
      return { optionalChainingCount: 0, nullishCoalescingCount: 0, total: 0 };
    }
  },
});

// Agent role: count optional chaining and nullish coalescing operators across TypeScript files.
const tsOptionalChainingCounter = agent({
  model: "small",
  instructions: p`Count optional chaining (?.) and nullish coalescing (??) operator usage in TypeScript files.

TypeScript files found:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -name '*.d.ts' | head -25")}

Steps:
1. For each file path, call countNullSafetyOperators to get per-file counts.
2. Build files record keyed by file path.
3. totalOptionalChaining = sum of all optionalChainingCount.
4. totalNullishCoalescing = sum of all nullishCoalescingCount.
5. mostUsedFile = path with highest total (omit if all totals are 0).`,
  output: s.object({
    files: s.record(s.object({
      optionalChainingCount: s.int,
      nullishCoalescingCount: s.int,
      total: s.int,
    })),
    totalOptionalChaining: s.int,
    totalNullishCoalescing: s.int,
    mostUsedFile: s.optional(s.string),
  }),
  tools: [countNullSafetyOperators],
  addons: [steering()],
});

export default tsOptionalChainingCounter;
```
