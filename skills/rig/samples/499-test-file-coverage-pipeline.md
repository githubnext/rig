# 499 - Test File Coverage Pipeline

```rig
import { agent, defineTool, workflow, p, s } from "rig";

// Agent role: discover all test and spec files in the workspace.
const testDiscoverer = agent({
  model: "small",
  instructions: p`Find test files with ${p.glob("**/*.test.ts")} and spec files with ${p.bash("find . -name '*.spec.ts' -not -path '*/node_modules/*' 2>/dev/null | head -30 || true")}. Return distinct lists and total count.`,
  output: s.object({
    testFiles: s.array(s.path),
    specFiles: s.array(s.path),
    totalCount: s.int,
  }),
});

const classifyTest = defineTool("classifyTest", {
  description: "Classify a test file as unit, integration, or e2e based on its path and name",
  parameters: s.object({ file: s.path, lineCount: s.int }),
  handler({ file }): "unit" | "integration" | "e2e" {
    if (file.includes("e2e") || file.includes("end-to-end")) return "e2e" as const;
    if (file.includes("integration") || file.includes("integ")) return "integration" as const;
    return "unit" as const;
  },
});

// Agent role: classify test files by type and produce counts.
const testClassifier = agent({
  model: "small",
  input: s.object({ testFiles: s.array(s.path), specFiles: s.array(s.path), totalCount: s.int }),
  instructions: p`Use classifyTest for each file in input.testFiles and input.specFiles. Also check file sizes using ${p.bash("wc -l $(find . -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null | head -10 | tr '\\n' ' ') 2>/dev/null || true")}. Return classification map and counts.`,
  output: s.object({
    classifications: s.record(s.string),
    unitCount: s.int,
    integrationCount: s.int,
    e2eCount: s.int,
  }),
  tools: [classifyTest],
});

// Workflow role: discover test files, classify them, and produce a report.
const testFileCoveragePipeline = workflow({
  meta: { name: "test-file-coverage-pipeline", description: "Discover and classify test files in a three-stage pipeline" },
  body: async ({ call }) => {
    const discovered = await call(testDiscoverer, "");
    const classified = await call(testClassifier, discovered ?? { testFiles: [], specFiles: [], totalCount: 0 });
    return {
      totalFiles: discovered?.totalCount ?? 0,
      unitCount: classified?.unitCount ?? 0,
      integrationCount: classified?.integrationCount ?? 0,
      e2eCount: classified?.e2eCount ?? 0,
      classifications: classified?.classifications ?? {},
    };
  },
});

export default testFileCoveragePipeline;
```
