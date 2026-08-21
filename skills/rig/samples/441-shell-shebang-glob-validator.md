# 441 - Shell Shebang Glob Validator

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";
import { repair } from "rig";

const checkShebangLine = defineTool("checkShebangLine", {
  description: "Check if a shell script has a valid shebang line",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const firstLine = content.split("\n")[0] ?? "";
    const hasShebang = firstLine.startsWith("#!");
    const shebangLine = hasShebang ? firstLine : undefined;
    const standardShebangs = ["/bin/sh", "/bin/bash", "/usr/bin/env bash", "/usr/bin/env sh"];
    const isStandard = hasShebang && standardShebangs.some(s => firstLine.includes(s));
    return { hasShebang, shebangLine, isStandard };
  },
});

// Agent role: Find all shell scripts and validate their shebang lines.
const shellShebangGlobValidator = agent({
  model: "small",
  instructions: p`You have these shell script files: ${p.glob("**/*.sh")}.
For each file, call checkShebangLine to inspect its shebang.
Return all files with their shebang status, plus counts of missing and standard shebangs.`,
  output: s.object({
    files: s.record(s.object({
      hasShebang: s.boolean,
      shebangLine: s.optional(s.string),
      isStandard: s.boolean,
    })),
    missingShebangCount: s.int,
    standardShebangCount: s.int,
    totalFiles: s.int,
  }),
  tools: [checkShebangLine],
  addons: [repair()],
});

export default shellShebangGlobValidator;
```
