# 327 - Vitest Test File Classifier

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: classify vitest test files by type and gather test count statistics.
const vitestTestFileClassifier = agent({
  model: "small",
  instructions: p`Discover and classify all vitest test files in this workspace.
Test files: ${p.glob("**/*.test.ts")}
For each file use the classifyTestFile tool. Return a record keyed by file path plus aggregate counts.`,
  output: s.object({
    files: s.record(s.object({
      testType: s.enum("unit", "integration", "e2e", "snapshot", "unknown"),
      testCount: s.int,
      usesMocks: s.boolean,
    })),
    totalFiles: s.int,
    unitCount: s.int,
    integrationCount: s.int,
  }),
  tools: [
    defineTool("classifyTestFile", {
      description: "Read a test file and classify its type and count tests",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const usesMocks = /vi\.mock\(/.test(content);
        const testCount = (content.match(/\b(?:test|it)\s*\(/g) ?? []).length;
        let testType: "unit" | "integration" | "e2e" | "snapshot" | "unknown";
        if (/toMatchSnapshot|toMatchInlineSnapshot/.test(content)) {
          testType = "snapshot";
        } else if (/e2e|end.to.end|playwright|cypress/i.test(content)) {
          testType = "e2e";
        } else if (/integration|supertest|request\(app/i.test(content)) {
          testType = "integration";
        } else if (testCount > 0) {
          testType = "unit";
        } else {
          testType = "unknown";
        }
        return { testType, testCount, usesMocks };
      },
    }),
  ],
  addons: [steering()],
});

export default vitestTestFileClassifier;
```
