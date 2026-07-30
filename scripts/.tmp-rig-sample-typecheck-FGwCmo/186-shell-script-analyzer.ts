import { agent, defineTool, p, s } from "rig";

const analyzeShellScript = defineTool("analyzeShellScript", {
  description: "Read a shell script file and analyze its safety flags and shebang",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const lines = content.split("\n");
      const shebang = lines[0]?.startsWith("#!") ? lines[0] : null;
      const hasSetE = /\bset\s+-[a-z]*e/.test(content) || /\bset\s+-e\b/.test(content);
      const hasSetU = /\bset\s+-[a-z]*u/.test(content) || /\bset\s+-u\b/.test(content);
      const hasPipefail = /set\s+-o\s+pipefail/.test(content);
      const safetyLevel = hasSetE && hasSetU && hasPipefail ? "strict"
        : hasSetE || hasSetU ? "partial"
        : "unsafe";
      return { shebang, hasSetE, hasSetU, hasPipefail, safetyLevel };
    } catch {
      return { shebang: null, hasSetE: false, hasSetU: false, hasPipefail: false, safetyLevel: "unsafe" };
    }
  },
});

// Agent role: find shell scripts and analyze each for safety flag usage.
const shellScriptAnalyzer = agent({
  model: "typecheck",
  tools: [analyzeShellScript],
  instructions: p`Find shell scripts: ${p.bash("find . -name '*.sh' -not -path '*/node_modules/*' 2>/dev/null | head -20 || echo ''")}. For each .sh file found, call analyzeShellScript to inspect its shebang and safety flags (set -e, set -u, set -o pipefail). Return a record keyed by file path.`,
  output: s.record(s.object({
    shebang: s.optional(s.string),
    hasSetE: s.boolean,
    hasSetU: s.boolean,
    hasPipefail: s.boolean,
    safetyLevel: s.enum("strict", "partial", "unsafe"),
  })),
});

export default shellScriptAnalyzer;
