# 305 - Shell Script Safety Analyzer

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const analyzeShellScript = defineTool("analyzeShellScript", {
  description: "Analyze a shell script file for safety flags (set -e, set -u, set -o pipefail) and shebang",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8").catch(() => "");
    const lines = content.split("\n");
    const shebangLine = lines[0] ?? "";
    const shebang = shebangLine.startsWith("#!") ? shebangLine.slice(2).trim() : undefined;
    const hasSetE = /\bset\b.*-[a-zA-Z]*e/.test(content) || /\bset\b.*-e/.test(content);
    const hasSetU = /\bset\b.*-[a-zA-Z]*u/.test(content) || /\bset\b.*-u/.test(content);
    const hasPipefail = /set\s+-o\s+pipefail/.test(content);
    let safetyLevel: "strict" | "partial" | "unsafe";
    if (hasSetE && hasSetU && hasPipefail) safetyLevel = "strict";
    else if (hasSetE || hasSetU || hasPipefail) safetyLevel = "partial";
    else safetyLevel = "unsafe";
    return { shebang, hasSetE, hasSetU, hasPipefail, safetyLevel };
  },
});

// Agent role: Scan shell scripts for safety flags and classify each by safety level.
const shellScriptSafetyAnalyzer = agent({
  model: "small",
  instructions: p`Find all shell scripts and analyze each for safety flags.

Shell script files:
${p.bash("find . -name '*.sh' -not -path '*/node_modules/*' | head -20 2>/dev/null || echo 'no shell scripts'")}

Use the analyzeShellScript tool on each .sh file path listed above.
Return a record keyed by file path with safety analysis for each script.`,
  output: s.record(s.object({
    shebang: s.optional(s.string),
    hasSetE: s.boolean,
    hasSetU: s.boolean,
    hasPipefail: s.boolean,
    safetyLevel: s.enum("strict", "partial", "unsafe"),
  })),
  tools: [analyzeShellScript],
  addons: [steering()],
});

export default shellScriptSafetyAnalyzer;
```
