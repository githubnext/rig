# 437 - TS Symbol Frequency Recorder

```rig
import { agent, p, s, defineTool, repair } from "rig";

const countSymbolUsage = defineTool("countSymbolUsage", {
  description: "Count identifier frequency in a TypeScript source file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const freq: Record<string, number> = {};
    const matches = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g) || [];
    for (const sym of matches) {
      freq[sym] = (freq[sym] ?? 0) + 1;
    }
    return freq;
  },
});

// Agent role: record identifier frequency across TypeScript source files.
const tsSymbolFrequencyRecorder = agent({
  model: "small",
  instructions: p`Record identifier frequency across TypeScript source files.

TypeScript files:
${p.glob("src/**/*.ts")}

For each file path, call countSymbolUsage to get a frequency record.
Merge all per-file records into a single global symbolFrequency map (sum counts for duplicates).
Compute totalFiles (count of files processed) and uniqueSymbols (number of distinct keys in symbolFrequency).
Build topSymbols as the top 10 entries by count sorted descending, each with symbol and count.`,
  tools: [countSymbolUsage],
  output: s.object({
    totalFiles: s.int,
    uniqueSymbols: s.int,
    topSymbols: s.array(s.object({ symbol: s.string, count: s.int })),
    symbolFrequency: s.record(s.int),
  }),
  maxTurns: 6,
  addons: [repair()],
});

export default tsSymbolFrequencyRecorder;
```
