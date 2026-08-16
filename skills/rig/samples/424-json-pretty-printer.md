# 424 - Json Pretty Printer

```rig
import { agent, s, defineTool, repair } from "rig";
import { readFile, writeFile } from "node:fs/promises";

const readJsonFile = defineTool("readJsonFile", {
  description: "Read and parse a JSON file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as unknown;
  },
});

const analyzeJsonStructure = defineTool("analyzeJsonStructure", {
  description: "Recursively count keys, depth, arrays, and objects in a JSON value.",
  parameters: s.object({ json: s.unknown }),
  handler({ json }: { json: unknown }) {
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
        for (const v of Object.values(val as Record<string, unknown>)) {
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
  parameters: s.object({ filePath: s.path, content: s.unknown }),
  async handler({ filePath, content }: { filePath: string; content: unknown }) {
    await writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
    return { written: true };
  },
});

// Agent role: pretty-print a JSON file and report structural statistics.
const jsonPrettyPrinter = agent({
  model: "small",
  input: s.object({ inputFile: s.string, outputFile: s.string }),
  instructions: `Pretty-print a JSON file and return structural statistics.

Steps:
1. Call readJsonFile with inputFile from input.
2. Call analyzeJsonStructure with the parsed JSON to get keyCount, depth, arrayCount, objectCount.
3. Call writeJsonFile with outputFile and the parsed JSON.
4. Return all stats, outputFile from input, and prettyPrinted: true.`,
  output: s.object({
    keyCount: s.int,
    depth: s.int,
    arrayCount: s.int,
    objectCount: s.int,
    outputFile: s.string,
    prettyPrinted: s.boolean,
  }),
  tools: [readJsonFile, analyzeJsonStructure, writeJsonFile],
  addons: [repair()],
});

export default jsonPrettyPrinter;
```
