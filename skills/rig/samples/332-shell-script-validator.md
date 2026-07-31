# 332 - Shell Script Validator

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const validateScript = defineTool("validateScript", {
  description: "Validate a shell script for safety best practices",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const src = await readFile(filePath, "utf-8");
    const hasShebang = src.startsWith("#!");
    const hasSafeFlags = /set\s+-[euo]*[euo]/.test(src);
    const hasEval = /\beval\b/.test(src);
    const functionCount = (src.match(/\bfunction\s+\w+|^\w+\s*\(\s*\)/gm) ?? []).length;
    let quality: "excellent" | "good" | "fair" | "poor";
    if (hasShebang && hasSafeFlags && !hasEval) quality = "excellent" as const;
    else if (hasShebang && hasSafeFlags) quality = "good" as const;
    else if (hasShebang) quality = "fair" as const;
    else quality = "poor" as const;
    return { hasShebang, hasSafeFlags, hasEval, functionCount, quality };
  },
});

// Agent role: find shell scripts and validate each for shebang, safe flags, eval usage, and function count.
const shellScriptValidator = agent({
  model: "small",
  instructions: p`Shell scripts found: ${p.bash("find . -name '*.sh' -not -path '*/node_modules/*' | head -30")}
Call validateScript for each path and return results keyed by file path.`,
  output: s.record(s.object({
    hasShebang: s.boolean,
    hasSafeFlags: s.boolean,
    hasEval: s.boolean,
    functionCount: s.int,
    quality: s.enum("excellent", "good", "fair", "poor"),
  })),
  tools: [validateScript],
  addons: [steering()],
  maxTurns: 6,
});

export default shellScriptValidator;
```
