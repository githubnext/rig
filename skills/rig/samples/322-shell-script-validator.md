# 322 - Shell Script Validator

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: validate shell scripts for safety practices and assign a quality rating.
const shellScriptValidator = agent({
  model: "small",
  instructions: p`Find all shell scripts (excluding node_modules) and validate each one.
Scripts found: ${p.bash("find . -name '*.sh' -not -path '*/node_modules/*'")}
For each script, read its content and use the validateScript tool.
Return a record keyed by file path.`,
  output: s.record(s.object({
    hasShebang: s.boolean,
    hasSafeFlags: s.boolean,
    hasEval: s.boolean,
    functionCount: s.int,
    quality: s.enum("excellent", "good", "fair", "poor"),
  })),
  tools: [
    defineTool("validateScript", {
      description: "Validate a shell script for safety practices",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const lines = content.split("\n");
        const hasShebang = lines[0]?.startsWith("#!") ?? false;
        const hasSafeFlags = /set\s+-[eux]*e[eux]*/.test(content) || /set\s+-euo\s+pipefail/.test(content);
        const hasEval = /\beval\b/.test(content);
        const functionCount = (content.match(/\bfunction\s+\w+|\w+\s*\(\s*\)/g) ?? []).length;
        const quality = hasShebang && hasSafeFlags && !hasEval ? "excellent" as const
          : hasShebang && hasSafeFlags ? "good" as const
          : hasShebang ? "fair" as const
          : "poor" as const;
        return { hasShebang, hasSafeFlags, hasEval, functionCount, quality };
      },
    }),
  ],
  addons: [steering()],
});

export default shellScriptValidator;
```
