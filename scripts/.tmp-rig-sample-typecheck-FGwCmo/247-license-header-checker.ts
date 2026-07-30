import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const checkLicenseHeader = defineTool("checkLicenseHeader", {
  description: "Check whether a TypeScript file starts with the expected license header.",
  parameters: { filePath: s.string, expectedHeader: s.string },
  handler: async ({ filePath, expectedHeader }: { filePath: string; expectedHeader: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const headerLines = expectedHeader.split("\n");
      const fileStart = lines.slice(0, headerLines.length).join("\n");
      if (fileStart === expectedHeader) return "ok";
      if (content.includes(expectedHeader.split("\n")[0])) return "wrong";
      return "missing";
    } catch {
      return "missing";
    }
  },
});

// Agent role: check that all TypeScript source files contain the expected license header.
const licenseHeaderChecker = agent({
  model: "typecheck",
  input: s.object({ expectedHeader: s.string }),
  instructions: p`Check each TypeScript file for the expected license header.

TypeScript files in the workspace:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -60")}

Steps:
1. Read expectedHeader from the input.
2. For each file path, call checkLicenseHeader with the filePath and expectedHeader.
3. Build a files record keyed by file path with hasHeader and status.
4. Count missingCount (status = "missing" or "wrong").
5. Set allCompliant to true only if missingCount is 0.`,
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
  addons: [repair()],
});

export default licenseHeaderChecker;
