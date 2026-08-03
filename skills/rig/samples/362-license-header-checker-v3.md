# 362 - License Header Checker V3

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const checkLicenseHeader = defineTool("checkLicenseHeader", {
  description: "Check whether a file's first lines match the expected license header.",
  parameters: s.object({ filePath: s.path, expectedHeader: s.string }),
  handler: async ({ filePath, expectedHeader }: { filePath: string; expectedHeader: string }) => {
    try {
      const content = await readFile(filePath, "utf8");
      const hasHeader = content.startsWith(expectedHeader);
      const status = hasHeader ? ("ok" as const) : content.trimStart().startsWith("//") || content.trimStart().startsWith("/*") ? ("wrong" as const) : ("missing" as const);
      return { hasHeader, status };
    } catch {
      return { hasHeader: false, status: "missing" as const };
    }
  },
});

// Agent role: check that all TypeScript files contain the expected license header.
const licenseHeaderChecker = agent({
  model: "small",
  input: s.object({ expectedHeader: s.string }),
  instructions: p`Check all TypeScript files for the expected license header.

TypeScript files found:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -100 || echo ''")}

Steps:
1. For each file path, call checkLicenseHeader with the file path and input.expectedHeader.
2. Build the files record keyed by file path with hasHeader and status.
3. Count missingCount (status != "ok").
4. Set allCompliant = (missingCount === 0).`,
  output: s.object({
    files: s.record(s.object({
      hasHeader: s.boolean,
      status: s.enum("ok", "missing", "wrong"),
    })),
    missingCount: s.number,
    allCompliant: s.boolean,
  }),
  tools: [checkLicenseHeader],
  maxTurns: 8,
  addons: [],
});

export default licenseHeaderChecker;
```
