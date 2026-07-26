# 135 - Test Coverage Mapper

```rig
import { agent, p, s, defineTool } from "rig";

const matchTestFile = defineTool("matchTestFile", {
  description: "Find matching test files for a source file using filename heuristics",
  parameters: s.object({ sourceFile: s.string, testFiles: s.array(s.string) }),
  handler: ({ sourceFile, testFiles }) => {
    const base = sourceFile.replace(/\.tsx?$/, "").replace(/.*\//, "");
    const matches = testFiles.filter(
      (t) => t.includes(base + ".test") || t.includes(base + ".spec")
    );
    return JSON.stringify({ matches, partial: matches.length === 0 ? testFiles.filter((t) => t.includes(base)).slice(0, 2) : [] });
  },
});

// Agent role: map each TypeScript source file to its test files using filename heuristics.
const testCoverageMapper = agent({
  model: "small",
  maxTurns: 4,
  instructions: p`Map source files to their test counterparts.

Source files: ${p.bash("find . -type f -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -not -path '*/node_modules/*' | head -50")}

Test files: ${p.bash("find . -type f \\( -name '*.test.ts' -o -name '*.spec.ts' \\) -not -path '*/node_modules/*' | head -50")}

For each source file use matchTestFile to find matches. Classify coverage: covered (matches found), partial (weak match), uncovered (none). Return a record keyed by source file path.`,
  output: s.record(s.object({
    coverage: s.enum("covered", "uncovered", "partial"),
    testFiles: s.array(s.string),
    reason: s.string,
  })),
  tools: [matchTestFile],
});

export default testCoverageMapper;
```
