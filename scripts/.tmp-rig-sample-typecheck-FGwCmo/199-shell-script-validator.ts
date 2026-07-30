import { agent, p, s, defineTool, steering } from "rig";

const validateScript = defineTool("validateScript", {
  description: "Validate a shell script for safety flags and structure",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8").catch(() => "");
    const lines = content.split("\n");
    const hasShebang = lines[0]?.startsWith("#!");
    const hasSafeFlags = /set\s+-[^#]*e/.test(content) && /set\s+-[^#]*u/.test(content);
    const hasEval = /\beval\b/.test(content);
    const functionCount = (content.match(/^\s*(function\s+\w+|\w+\s*\(\s*\))/gm) ?? []).length;
    return { hasShebang, hasSafeFlags, hasEval, functionCount };
  },
});

// Agent role: validate shell scripts for safety flags and classify quality.
const shellScriptValidator = agent({
  model: "typecheck",
  instructions: p`Find all shell scripts: ${p.bash("find . -name '*.sh' -not -path '*/node_modules/*' 2>/dev/null | head -30")}. Use validateScript on each file. Classify quality: excellent (shebang + safe flags + no eval), good (shebang + safe flags), fair (shebang only), poor (no shebang).`,
  output: s.record(s.object({
    hasShebang: s.boolean,
    hasSafeFlags: s.boolean,
    hasEval: s.boolean,
    functionCount: s.int,
    quality: s.enum("excellent", "good", "fair", "poor"),
  })),
  tools: [validateScript],
  addons: steering({ message: "Classify every found script. If no scripts are found, return an empty record." }),
});

export default shellScriptValidator;
