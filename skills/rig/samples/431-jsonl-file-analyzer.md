# jsonl-file-analyzer - JSONL File Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const analyzeJsonLine = defineTool("analyzeJsonLine", {
  description: "Parse a single JSONL line and return validity, keys, and value types.",
  parameters: s.object({
    line: s.string,
  }),
  handler: async ({ line }) => {
    try {
      const obj = JSON.parse(line);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return { valid: false, keys: [] as string[], valueTypes: {} as Record<string, string> };
      }
      const keys = Object.keys(obj);
      const valueTypes: Record<string, string> = {};
      for (const k of keys) {
        const v = obj[k];
        valueTypes[k] = Array.isArray(v) ? "array" : typeof v;
      }
      return { valid: true, keys, valueTypes };
    } catch {
      return { valid: false, keys: [] as string[], valueTypes: {} as Record<string, string> };
    }
  },
});

// Agent role: analyze a JSONL file, report per-line validity, top keys, and schema consistency.
const jsonlFileAnalyzer = agent({
  model: "small",
  input: s.object({ inputFile: s.path }),
  output: s.object({
    totalLines: s.int,
    validLines: s.int,
    invalidLines: s.int,
    topKeys: s.array(s.string),
    schemaConsistent: s.boolean,
  }),
  instructions: p`Read the JSONL file at ${p.readInput("inputFile")} line by line. For each non-empty line call analyzeJsonLine. Count total, valid, and invalid lines. Identify the top 5 most frequent keys across all valid lines. Determine if all valid lines share the same key set (schemaConsistent). Return the declared output.`,
  tools: [analyzeJsonLine],
  addons: [repair()],
});

export default jsonlFileAnalyzer;
```
