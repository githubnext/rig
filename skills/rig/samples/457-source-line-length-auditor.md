# 457 - Source Line Length Auditor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const auditFileLengths = defineTool("auditFileLengths", {
  description: "Audit a file for lines exceeding the maximum length limit",
  parameters: s.object({ filePath: s.path, maxLen: s.optional(s.number) }),
  handler: async ({ filePath, maxLen = 100 }: { filePath: string; maxLen?: number }) => {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    let longLineCount = 0;
    let longestLine = 0;
    let worstLineNumber = 0;
    lines.forEach((line: string, idx: number) => {
      if (line.length > maxLen) {
        longLineCount++;
        if (line.length > longestLine) {
          longestLine = line.length;
          worstLineNumber = idx + 1;
        }
      }
    });
    return { longLineCount, longestLine, worstLineNumber };
  },
});

// Agent role: Audit TypeScript source files for lines exceeding maxLen and report violations.
const sourceLineLengthAuditor = agent({
  model: "small",
  input: s.object({ dir: s.string, maxLen: s.optional(s.number) }),
  instructions: p`Audit these TypeScript files for long lines: ${p.glob("**/*.ts")}. Call auditFileLengths for each file, passing maxLen from input. Return the full audit.`,
  output: s.object({
    files: s.record(s.object({
      longLineCount: s.int,
      longestLine: s.int,
      worstLineNumber: s.int,
    })),
    totalViolations: s.int,
    worstFile: s.string,
  }),
  tools: [auditFileLengths],
  addons: [repair()],
});

export default sourceLineLengthAuditor;

```
