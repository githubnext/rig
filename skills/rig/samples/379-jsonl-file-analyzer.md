# 379 - JSONL File Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const analyzeJsonLine = defineTool("analyzeJsonLine", {
  description: "Parse a single JSONL line and return its structure.",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return { valid: true, keys: [], valueTypes: {} as Record<string, string> };
      }
      const keys = Object.keys(obj);
      const valueTypes: Record<string, string> = {};
      for (const k of keys) {
        valueTypes[k] = Array.isArray(obj[k]) ? "array" : typeof obj[k];
      }
      return { valid: true, keys, valueTypes };
    } catch {
      return { valid: false, keys: [], valueTypes: {} as Record<string, string> };
    }
  },
});

// Agent role: analyze a JSONL file to report line validity and schema consistency.
const jsonlFileAnalyzer = agent({
  model: "small",
  input: s.object({
    inputFile: s.path,
  }),
  instructions: p`Analyze the JSONL (JSON Lines) file.

File contents:
${p.readInput("inputFile")}

Split the content by newlines. For each non-empty line, call analyzeJsonLine.
Track totalLines (all non-empty lines), validLines (lines that parse successfully), invalidLines (failed).
Collect all unique keys across valid lines and return the 10 most frequent as topKeys.
Set schemaConsistent to true if all valid lines share the exact same set of top-level keys.`,
  tools: [analyzeJsonLine],
  output: s.object({
    totalLines: s.int,
    validLines: s.int,
    invalidLines: s.int,
    topKeys: s.array(s.string),
    schemaConsistent: s.boolean,
  }),
  maxTurns: 4,
  addons: repair(),
});

export default jsonlFileAnalyzer;

```
