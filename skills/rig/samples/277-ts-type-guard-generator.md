# 277 - Ts Type Guard Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractInterfaces = defineTool("extractInterfaces", {
  description: "Extract interface names from a TypeScript source file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const matches = [...content.matchAll(/interface\s+(\w+)/g)];
      return { interfaceNames: matches.map((m: RegExpMatchArray) => m[1] as string) };
    } catch {
      return { interfaceNames: [] };
    }
  },
});

// Agent role: generate TypeScript type guard functions for each interface in a source file.
const tsTypeGuardGenerator = agent({
  model: "small",
  addons: repair(),
  input: s.object({ sourceFile: s.path, outputFile: s.path }),
  instructions: p`Generate TypeScript type guard functions for interfaces found in a source file.

Source file content:
${p.readInput("sourceFile")}

1. Call extractInterfaces with the sourceFile path to get all interface names.
2. For each interface, generate a type guard function: \`function is<Name>(val: unknown): val is <Name>\`.
3. Write the generated guard functions to the outputFile path.
4. Return generatedGuards listing interfaceName and guardFunctionName for each guard.`,
  tools: [extractInterfaces],
  output: s.object({
    generatedGuards: s.array(
      s.object({ interfaceName: s.string, guardFunctionName: s.string })
    ),
    outputFile: s.path,
    totalGenerated: s.int,
  }),
});

export default tsTypeGuardGenerator;
```
