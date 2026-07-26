# 125 - Test Coverage Mapper

```rig
import { agent, p, s, defineTool } from "rig";

const findTestFile = defineTool("findTestFile", {
  description: "Find the best matching test file for a given source file using filename heuristics",
  parameters: s.object({
    sourceFile: s.string,
    testFiles: s.array(s.string),
  }),
  handler: ({ sourceFile, testFiles }) => {
    const baseName = sourceFile.replace(/\.ts$/, "").replace(/.*\//, "");
    const matches = testFiles.filter(
      (t) =>
        t.includes(baseName + ".test") ||
        t.includes(baseName + ".spec") ||
        t.includes(baseName.replace(/([A-Z])/g, "-$1").toLowerCase())
    );
    return JSON.stringify(matches);
  },
});

// Agent role: map source files to their test files using filename heuristics
const testCoverageMapper = agent({
  name: "testCoverageMapper",
  model: "small",
  maxTurns: 2,
  instructions: p`Map source files to their corresponding test files using filename heuristics.

Source files: ${p.bash("find . -type f -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -not -path '*/node_modules/*' | head -50")}

Test files: ${p.bash("find . -type f \\( -name '*.test.ts' -o -name '*.spec.ts' \\) -not -path '*/node_modules/*' | head -50")}

For each source file, use the findTestFile tool to look up matching test files.
Set coverage:
- covered: one or more test files found
- partial: test file found but name match is weak
- uncovered: no test files found

Return a record keyed by source file path.`,
  output: s.record(
    s.object({
      coverage: s.enum("covered", "uncovered", "partial"),
      testFiles: s.array(s.string),
      reason: s.string,
    })
  ),
  tools: [findTestFile],
});

export default testCoverageMapper;
```
