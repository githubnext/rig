# 370 - JSON Pretty Printer Stats

```rig
import { agent, s, defineTool, repair } from "rig";
import { readFile, writeFile } from "node:fs/promises";

const readJsonFile = defineTool("readJsonFile", {
  description: "Read and parse a JSON file, returning its contents.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  },
});

const analyzeJsonStructure = defineTool("analyzeJsonStructure", {
  description: "Analyze the structure of a JSON value and return key count, depth, array count, and object count.",
  parameters: { json: s.unknown },
  handler: ({ json }: { json: unknown }) => {
    let keyCount = 0;
    let depth = 0;
    let arrayCount = 0;
    let objectCount = 0;
    function walk(val: unknown, d: number): void {
      if (d > depth) depth = d;
      if (Array.isArray(val)) {
        arrayCount++;
        for (const item of val) walk(item, d + 1);
      } else if (val !== null && typeof val === "object") {
        objectCount++;
        for (const [, v] of Object.entries(val as Record<string, unknown>)) {
          keyCount++;
          walk(v, d + 1);
        }
      }
    }
    walk(json, 0);
    return { keyCount, depth, arrayCount, objectCount };
  },
});

const writeJsonFile = defineTool("writeJsonFile", {
  description: "Write a value as pretty-printed JSON to a file.",
  parameters: { filePath: s.path, content: s.unknown },
  handler: async ({ filePath, content }: { filePath: string; content: unknown }) => {
    await writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
    return { written: true };
  },
});

const jsonPrettyPrinterStats = agent({
  model: "small",
  input: s.object({ inputFile: s.string, outputFile: s.string }),
  instructions: `Pretty-print a JSON file and report structural statistics.

Steps:
1. Call readJsonFile with the inputFile from input to get the parsed JSON.
2. Call analyzeJsonStructure with the parsed JSON to get keyCount, depth, arrayCount, objectCount.
3. Call writeJsonFile with outputFile and the parsed JSON to write the pretty-printed output.
4. Return keyCount, depth, arrayCount, objectCount, outputFile (from input), prettyPrinted: true.`,
  output: s.object({
    keyCount: s.number,
    depth: s.number,
    arrayCount: s.number,
    objectCount: s.number,
    outputFile: s.string,
    prettyPrinted: s.boolean,
  }),
  tools: [readJsonFile, analyzeJsonStructure, writeJsonFile],
  addons: [repair()],
});

export default jsonPrettyPrinterStats;
```
