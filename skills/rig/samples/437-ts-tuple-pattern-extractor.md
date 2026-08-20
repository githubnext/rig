# ts-tuple-pattern-extractor - TypeScript Tuple Pattern Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractTuplePatternsFromFile = defineTool("extractTuplePatternsFromFile", {
  description: "Count tuple type patterns in a TypeScript file.",
  parameters: s.object({
    filePath: s.string,
  }),
  handler: async ({ filePath }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const tuplePattern = /:\s*\[[\w\s,.|&?<>]+\]/g;
    const readonlyPattern = /readonly\s*\[[\w\s,.|&?<>\.\.\.]+\]/g;
    const spreadPattern = /\.\.\.\w+/g;
    const tuples: string[] = content.match(tuplePattern) ?? [];
    const readonlyTuples: string[] = content.match(readonlyPattern) ?? [];
    const allTuples = tuples.concat(readonlyTuples);
    const hasSpreads = allTuples.some((t) => spreadPattern.test(t));
    return {
      tupleCount: allTuples.length,
      hasSpreads,
      readonlyCount: readonlyTuples.length,
    };
  },
});

// Agent role: scan TypeScript source files for tuple type patterns and report statistics.
const tsTuplePatternExtractor = agent({
  model: "small",
  output: s.object({
    files: s.record(s.object({
      tupleCount: s.int,
      hasSpreads: s.boolean,
      readonlyCount: s.int,
    })),
    totalTuples: s.int,
    totalFiles: s.int,
    mostTupledFile: s.optional(s.string),
  }),
  instructions: p`Find TypeScript files with ${p.glob("src/**/*.ts")}. For each file call extractTuplePatternsFromFile. Return a files record keyed by path, totalTuples (sum of all tupleCount), totalFiles, and mostTupledFile (path with highest tupleCount, or omit if none found).`,
  tools: [extractTuplePatternsFromFile],
  addons: [repair()],
});

export default tsTuplePatternExtractor;
```
