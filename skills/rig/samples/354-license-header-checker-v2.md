# 354 - License Header Checker V2

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const checkLicenseHeader = defineTool("checkLicenseHeader", {
  description: "Check whether a TypeScript file starts with the expected license header.",
  parameters: { filePath: s.string, expectedHeader: s.string },
  handler: async ({ filePath, expectedHeader }: { filePath: string; expectedHeader: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const headerLines = expectedHeader.split("\n");
      const fileStart = content.split("\n").slice(0, headerLines.length).join("\n");
      const hasHeader = fileStart === expectedHeader;
      const status = hasHeader
        ? ("ok" as const)
        : content.includes(headerLines[0])
          ? ("wrong" as const)
          : ("missing" as const);
      return { hasHeader, status };
    } catch {
      return { hasHeader: false, status: "missing" as const };
    }
  },
});

// Agent role: check that all TypeScript source files contain the expected license header.
const licenseHeaderChecker = agent({
  model: "small",
  input: s.object({ expectedHeader: s.string }),
  instructions: p`Check each TypeScript file for the expected license header provided in the input.

TypeScript files in the workspace:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -60")}

Steps:
1. Read expectedHeader from the agent input.
2. For each file path, call checkLicenseHeader with filePath and expectedHeader.
3. Build a files record keyed by file path containing hasHeader and status.
4. Count missingCount as files where status is "missing" or "wrong".
5. Set allCompliant to true only if missingCount is 0.`,
  output: s.object({
    files: s.record(s.object({
      hasHeader: s.boolean,
      status: s.enum("ok", "missing", "wrong"),
    })),
    missingCount: s.int,
    allCompliant: s.boolean,
  }),
  tools: [checkLicenseHeader],
  maxTurns: 8,
  addons: [repair()],
});

export default licenseHeaderChecker;

```
