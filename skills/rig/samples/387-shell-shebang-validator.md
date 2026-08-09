# 387 - Shell Shebang Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const checkShebangLine = defineTool("checkShebangLine", {
  description: "Check if a shell script has a valid shebang line on the first line",
  parameters: s.object({
    filePath: s.path,
  }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const firstLine = content.split("\n")[0] ?? "";
    const hasShebang = firstLine.startsWith("#!");
    const standardShebangs = ["#!/bin/sh", "#!/bin/bash", "#!/usr/bin/env bash", "#!/usr/bin/env sh"];
    const isStandard = standardShebangs.some((s) => firstLine.startsWith(s));
    return {
      hasShebang,
      shebangLine: hasShebang ? firstLine : undefined,
      isStandard,
    };
  },
});

// Agent role: Validate shebang lines in all shell scripts found in the workspace.
const shellShebangValidator = agent({
  model: "small",
  instructions: p`You are a shell script shebang validator.
Shell scripts found: ${p.glob("**/*.sh")}

For each shell script, call checkShebangLine to verify the shebang.
Count files missing a shebang and those with a standard shebang.
Return the output schema.`,
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

export default shellShebangValidator;
```
