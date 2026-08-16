# 425 - Ts Interface Method Counter

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const countInterfaceMethods = defineTool("countInterfaceMethods", {
  description: "Count method signatures inside TypeScript interface declarations in a file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const content = await readFile(filePath, "utf-8");
    const results: Record<string, { methodCount: number; hasOptionalMethods: boolean; sourceFile: string }> = {};
    const ifaceRe = /interface\s+(\w+)[^{]*\{([^}]*)\}/gs;
    let m: RegExpExecArray | null;
    while ((m = ifaceRe.exec(content)) !== null) {
      const name = m[1];
      const body = m[2];
      const methods = (body.match(/\w+\??\s*\([^)]*\)/g) ?? []);
      const hasOptionalMethods = /\w+\?\s*\(/.test(body);
      results[name] = { methodCount: methods.length, hasOptionalMethods, sourceFile: filePath };
    }
    return results;
  },
});

// Agent role: count method signatures in TypeScript interfaces across source files.
const tsInterfaceMethodCounter = agent({
  model: "small",
  instructions: p`Count method signatures in TypeScript interface declarations.

TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path, call countInterfaceMethods and merge the returned records.
Compute:
- totalInterfaces = total interface names found
- averageMethodCount = total methods / totalInterfaces (0 if none)
- largestInterface = name with most methods (omit if no interfaces)`,
  output: s.object({
    interfaces: s.record(s.object({
      methodCount: s.int,
      hasOptionalMethods: s.boolean,
      sourceFile: s.string,
    })),
    totalInterfaces: s.int,
    averageMethodCount: s.number,
    largestInterface: s.optional(s.string),
  }),
  tools: [countInterfaceMethods],
  maxTurns: 6,
  addons: [steering()],
});

export default tsInterfaceMethodCounter;
```
