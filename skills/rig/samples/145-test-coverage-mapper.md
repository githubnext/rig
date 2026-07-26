# 145 - Test Coverage Mapper

```rig
import { agent, p, s, defineTool, repair } from "rig";

const matchTestFile = defineTool("matchTestFile", {
  description: "Heuristically find test files matching a source file by name.",
  parameters: s.object({ sourcePath: s.string, testFiles: s.array(s.string) }),
  handler({ sourcePath, testFiles }) {
    const baseName = sourcePath.split("/").pop()!.replace(/\.ts$/, "");
    const patterns = [
      `${baseName}.test.ts`,
      `${baseName}.spec.ts`,
      `${baseName}.test.js`,
      `${baseName}.spec.js`,
    ];
    const matched = testFiles.filter(f =>
      patterns.some(p => f.endsWith(p))
    );
    return { matched };
  },
});

// Agent role: Map source files to their test counterparts and classify coverage.
const testCoverageMapper = agent({
  model: "small",
  maxTurns: 2,
  instructions: p`Map source files to test files using filename heuristics.

Source files:
${p.bash("find . -type f -name '*.ts' ! -name '*.test.ts' ! -name '*.spec.ts' ! -path '*/node_modules/*' ! -path '*/.git/*' | head -40")}

Test files:
${p.bash("find . -type f \\( -name '*.test.ts' -o -name '*.spec.ts' \\) ! -path '*/node_modules/*' | head -40")}

For each source file, use matchTestFile to find matching test files.
Classify coverage:
- covered: at least one test file matched
- uncovered: no test files matched
- partial: test file exists but may not cover all exports (use heuristics)

Return s.record output keyed by source file path.`,
  tools: [matchTestFile],
  addons: repair(),
  output: s.record(
    s.object({
      coverage: s.enum("covered", "uncovered", "partial"),
      testFiles: s.array(s.string),
      reason: s.string,
    }),
  ),
});

export default testCoverageMapper;
```
