# 374 - TS Type Guard Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractInterfaces = defineTool("extractInterfaces", {
  description: "Extract interface names from a TypeScript file using regex.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const matches = [...content.matchAll(/^(?:export\s+)?interface\s+(\w+)/gm)];
    return matches.map((m: RegExpMatchArray) => m[1]);
  },
});

// Agent role: generate TypeScript type guard functions for interfaces found in a source file.
const tsTypeGuardGenerator = agent({
  model: "small",
  input: s.object({
    sourceFile: s.path,
    outputFile: s.path,
  }),
  instructions: p`Generate TypeScript type guard functions for interfaces in the source file.

Source file contents:
${p.readInput("sourceFile")}

1. Call extractInterfaces with the sourceFile path to get the list of interface names.
2. For each interface, generate a type guard function: \`export function is<Name>(val: unknown): val is <Name> { ... }\`
3. Write all generated type guards as valid TypeScript source to the output field "generatedSource".
4. Return generatedGuards (list of interface names), outputFile (the outputFile from input), totalGenerated (count).`,
  tools: [extractInterfaces],
  output: s.object({
    generatedGuards: s.array(s.string),
    outputFile: s.path,
    totalGenerated: s.int,
    generatedSource: s.string,
  }),
  maxTurns: 5,
  addons: repair(),
});

export default tsTypeGuardGenerator;

```
