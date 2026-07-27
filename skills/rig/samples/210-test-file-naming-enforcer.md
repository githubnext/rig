# 210 - Test File Naming Enforcer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyFile = defineTool("classifyFile", {
  description: "Classify a test filename against project naming conventions",
  parameters: s.object({
    filename: s.string,
  }),
  handler({ filename }) {
    const base = filename.split("/").pop() ?? filename;
    if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(base)) {
      return { convention: "correct" as const, suggestedName: null };
    }
    if (/\.(ts|js|tsx|jsx)$/.test(base) && /test|spec/i.test(base)) {
      return { convention: "wrong-suffix" as const, suggestedName: base.replace(/test|spec/i, "") + ".test." + base.split(".").pop() };
    }
    if (/Test\.(ts|js|tsx|jsx)$/.test(base)) {
      return { convention: "wrong-suffix" as const, suggestedName: base.replace(/Test\./, ".test.") };
    }
    return { convention: "missing-spec" as const, suggestedName: base.replace(/\.(ts|js|tsx|jsx)$/, ".test.$1") };
  },
});

// Agent role: scan test files and report which follow the <name>.test.ts / <name>.spec.ts naming convention.
const testFileNamingEnforcer = agent({
  model: "small",
  instructions: p`Find all test files: ${p.bash("find . \\( -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' -o -name '*Test.ts' -o -name '*Test.js' \\) -not -path '*/node_modules/*' | head -60")}. Use the classifyFile tool for each file path. Build a record keyed by file path with the convention classification and optional suggestedName. Set allConform to true only when every entry is classified as correct.`,
  output: s.object({
    files: s.record(s.object({
      convention: s.enum("correct", "wrong-prefix", "wrong-suffix", "missing-spec"),
      suggestedName: s.optional(s.string),
    })),
    allConform: s.boolean,
  }),
  tools: [classifyFile],
  maxTurns: 5,
  addons: repair(),
});

export default testFileNamingEnforcer;
```
