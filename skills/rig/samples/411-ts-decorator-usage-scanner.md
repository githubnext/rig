# 411 - TS Decorator Usage Scanner

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanDecorators = defineTool("scanDecorators", {
  description: "Scan a TypeScript file for decorator usages matching @UpperCase patterns",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const matches = content.match(/@[A-Z]\w+/g) ?? [];
    return { decorators: matches, filePath };
  },
});

// Agent role: Scan TypeScript source files for decorator usages and report counts per decorator.
const tsDecoratorScanner = agent({
  model: "small",
  instructions: p`Scan all TypeScript source files for decorator usage.
Files to scan: ${p.glob("src/**/*.ts")}
Use the scanDecorators tool on each file path listed above.
Return an object with:
- decorators: a record mapping each decorator name to { usageCount, files }
- totalDecorated: total number of files that had at least one decorator
- mostUsedDecorator: the decorator name with the highest usageCount, or omit if none found`,
  output: s.object({
    decorators: s.record(s.object({
      usageCount: s.int,
      files: s.array(s.path),
    })),
    totalDecorated: s.int,
    mostUsedDecorator: s.optional(s.string),
  }),
  tools: [scanDecorators],
  addons: [repair()],
});

export default tsDecoratorScanner;
```
