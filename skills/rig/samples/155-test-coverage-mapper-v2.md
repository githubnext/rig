# 155 - Test Coverage Mapper V2

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: map source files to their test files using filename heuristics.
const testCoverageMapperV2 = agent({
  model: "small",
  maxTurns: 2,
  instructions: p`Map TypeScript source files to their corresponding test files.

Source files (non-test TypeScript):
${p.bash("find . -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -30")}

Test files:
${p.bash("find . -name '*.test.ts' -o -name '*.spec.ts' | grep -v node_modules | head -30")}

Use the matchTestFile tool for each source file to find its corresponding test file using
filename heuristics (e.g., src/foo.ts -> src/foo.test.ts or tests/foo.test.ts).

Return a record keyed by source file path with coverage ("covered" if test found,
"uncovered" if none, "partial" if indirect match), testFiles (array of matched test paths),
and reason explaining the determination.`,
  tools: [
    defineTool("matchTestFile", {
      description: "Find test files that match a source file using naming heuristics",
      parameters: s.object({ sourceFile: s.string, testFiles: s.array(s.string) }),
      handler({ sourceFile, testFiles }) {
        const base = sourceFile.replace(/\.tsx?$/, "").replace(/^.*\//, "");
        const direct = testFiles.filter((t) =>
          t.includes(`${base}.test`) || t.includes(`${base}.spec`)
        );
        const partial = direct.length === 0
          ? testFiles.filter((t) => t.toLowerCase().includes(base.toLowerCase()))
          : [];
        return {
          matched: direct,
          partial,
          coverage: direct.length > 0 ? "covered" : partial.length > 0 ? "partial" : "uncovered",
        };
      },
    }),
  ],
  output: s.record(
    s.object({
      coverage: s.enum("covered", "uncovered", "partial"),
      testFiles: s.array(s.string),
      reason: s.string,
    })
  ),
});

export default testCoverageMapperV2;
```
