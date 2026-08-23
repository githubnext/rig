# 451 - Shell Shebang Glob Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const checkShebangLine = defineTool("checkShebangLine", {
  description: "Check if a shell script file has a shebang line and whether it is standard",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const firstLine = content.split("\n")[0] ?? "";
    const hasShebang = firstLine.startsWith("#!");
    const shebangLine = hasShebang ? firstLine : undefined;
    const isStandard = hasShebang && (firstLine === "#!/bin/sh" || firstLine === "#!/bin/bash" || firstLine === "#!/usr/bin/env bash" || firstLine === "#!/usr/bin/env sh");
    return { hasShebang, shebangLine, isStandard };
  },
});

// Agent role: Scan all shell scripts in the workspace and report shebang line status for each.
const shellShebangValidator = agent({
  model: "small",
  instructions: p`You are a shell script auditor. The workspace contains these shell scripts: ${p.glob("**/*.sh")}. For each file path listed, call the checkShebangLine tool. Then return the full result object.`,
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
