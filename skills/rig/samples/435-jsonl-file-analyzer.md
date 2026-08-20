# 435 - JSONL File Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseJSONLFile = defineTool("parseJSONLFile", {
  description: "Parse JSONL content: count valid/invalid lines and extract sample top-level keys.",
  parameters: s.object({ content: s.string }),
  handler({ content }: { content: string }) {
    const lines = content.split("\n").filter((l: string) => l.trim().length > 0);
    let validLines = 0;
    let invalidLines = 0;
    let sampleKeys: string[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        validLines++;
        if (sampleKeys.length === 0 && obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
          sampleKeys = Object.keys(obj).slice(0, 10);
        }
      } catch {
        invalidLines++;
      }
    }
    return { lineCount: lines.length, validLines, invalidLines, sampleKeys };
  },
});

// Agent role: analyze a JSONL file and report parse statistics.
const jsonlFileAnalyzer = agent({
  model: "small",
  input: s.object({ inputFile: s.path }),
  instructions: p`Analyze the JSONL (JSON Lines) file.

File contents:
${p.readInput("inputFile")}

Call parseJSONLFile with the complete file content.
Compute parseRate as validLines / lineCount (0 if lineCount is 0).
Set isEmpty to true if lineCount === 0.
Return all fields from the tool result plus parseRate and isEmpty.`,
  tools: [parseJSONLFile],
  output: s.object({
    lineCount: s.int,
    validLines: s.int,
    invalidLines: s.int,
    parseRate: s.number,
    sampleKeys: s.array(s.string),
    isEmpty: s.boolean,
  }),
  addons: [repair()],
});

export default jsonlFileAnalyzer;
```
