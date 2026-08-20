# 433 - TS Interface Method Counter

```rig
import { agent, p, s, defineTool } from "rig";

const countInterfaceMethods = defineTool("countInterfaceMethods", {
  description: "Count method signatures in TypeScript interfaces within a source file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const interfaces: Array<{ name: string; methodCount: number }> = [];
    const ifaceRe = /interface\s+(\w+)[^{]*\{([^}]*)\}/gs;
    let match: RegExpExecArray | null;
    while ((match = ifaceRe.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const methods = body.match(/\w+\??\s*\([^)]*\)/g) || [];
      interfaces.push({ name, methodCount: methods.length });
    }
    return { interfaceCount: interfaces.length, totalMethods: interfaces.reduce((a, i) => a + i.methodCount, 0), interfaces };
  },
});

// Agent role: count method signatures in TypeScript interfaces across all source files.
const tsInterfaceMethodCounter = agent({
  model: "small",
  instructions: p`Count TypeScript interface method signatures across source files.

TypeScript source files:
${p.glob("src/**/*.ts")}

For each file path, call countInterfaceMethods and collect the results.
Compute totalFiles (files processed), totalInterfaces (sum of interfaceCount across all files),
totalMethods (sum of totalMethods across all files).
Build files array with file, interfaceCount, methodCount per file.
Set topInterface to the interface name with most methods across all files, or omit if none found.`,
  tools: [countInterfaceMethods],
  output: s.object({
    totalFiles: s.int,
    totalInterfaces: s.int,
    totalMethods: s.int,
    files: s.array(s.object({ file: s.path, interfaceCount: s.int, methodCount: s.int })),
    topInterface: s.optional(s.string),
  }),
  maxTurns: 6,
});

export default tsInterfaceMethodCounter;
```
