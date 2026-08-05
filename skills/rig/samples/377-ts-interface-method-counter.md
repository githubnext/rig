# 377 - TS Interface Method Counter

```rig
import { agent, p, s, defineTool, steering } from "rig";

const countInterfaceMethods = defineTool("countInterfaceMethods", {
  description: "Count method signatures in TypeScript interfaces within a file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const results: Record<string, { methodCount: number; hasOptionalMethods: boolean; sourceFile: string }> = {};
    const ifaceRe = /interface\s+(\w+)[^{]*\{([^}]*)\}/gs;
    let match: RegExpExecArray | null;
    while ((match = ifaceRe.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const methods = (body.match(/\w+\??\s*\([^)]*\)/g) || []);
      const hasOptional = /\w+\?\s*\(/.test(body);
      results[name] = { methodCount: methods.length, hasOptionalMethods: hasOptional, sourceFile: filePath };
    }
    return results;
  },
});

// Agent role: count method signatures in TypeScript interfaces across the source tree.
const tsInterfaceMethodCounter = agent({
  model: "small",
  instructions: p`Count method signatures in TypeScript interfaces.

TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path listed, call countInterfaceMethods to extract interface method counts.
Merge all results into a single interfaces record keyed by interface name.
Compute totalInterfaces (total count of interface names found).
Compute averageMethodCount (total methods / totalInterfaces, or 0 if none).
Set largestInterface to the interface name with the most methods, or omit if no interfaces found.`,
  tools: [countInterfaceMethods],
  output: s.object({
    interfaces: s.record(
      s.object({
        methodCount: s.int,
        hasOptionalMethods: s.boolean,
        sourceFile: s.string,
      })
    ),
    totalInterfaces: s.int,
    averageMethodCount: s.number,
    largestInterface: s.optional(s.string),
  }),
  maxTurns: 6,
  addons: steering({ message: "Ensure every interface found is included in the interfaces record." }),
});

export default tsInterfaceMethodCounter;

```
