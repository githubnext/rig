# 394 - Vitest Test File Classifier

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: discover all vitest test files, classify each by type, count test
// calls, and detect mock usage.
const vitestTestFileClassifier = agent({
  model: "small",
  instructions: p`Classify all vitest test files in the workspace.
Test files: ${p.glob("**/*.test.ts")}
For each file call classifyTestFile. Aggregate counts by type.`,
  tools: [
    defineTool("classifyTestFile", {
      description: "Read a test file and classify its type, test count, and mock usage",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const hasMocks = /vi\.mock\(/.test(content);
        const testCount = (content.match(/\b(?:test|it)\s*\(/g) ?? []).length;
        let type: "unit" | "integration" | "e2e" | "snapshot" | "unknown";
        if (/toMatchSnapshot|toMatchInlineSnapshot/.test(content)) type = "snapshot";
        else if (/e2e|end.to.end|playwright|cypress/i.test(content)) type = "e2e";
        else if (/integration|supertest/i.test(content)) type = "integration";
        else if (testCount > 0) type = "unit";
        else type = "unknown";
        return { type, testCount, hasMocks };
      },
    }),
  ],
  output: s.object({
    files: s.record(s.object({
      type: s.enum("unit", "integration", "e2e", "snapshot", "unknown"),
      testCount: s.int,
      hasMocks: s.boolean,
    })),
    totalFiles: s.int,
    unitCount: s.int,
    integrationCount: s.int,
  }),
  addons: [steering()],
});

export default vitestTestFileClassifier;
```
