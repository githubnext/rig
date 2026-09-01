# 505 - Source Line Length Auditor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const auditLineLengths = defineTool("auditLineLengths", {
  description: "Audit line lengths in a source file",
  parameters: s.object({ filePath: s.string }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    let total = 0;
    let maxLength = 0;
    let longLineCount = 0;
    let veryLongLineCount = 0;
    for (const line of lines) {
      const len = line.length;
      total += len;
      if (len > maxLength) maxLength = len;
      if (len > 80) longLineCount++;
      if (len > 120) veryLongLineCount++;
    }
    const avgLength = lines.length > 0 ? total / lines.length : 0;
    return { avgLength, maxLength, longLineCount, veryLongLineCount };
  },
});

// Agent role: Audit line lengths across all TypeScript source files and identify the most verbose file.
const sourceLineLengthAuditor = agent({
  model: "small",
  instructions: p`Audit TypeScript source files found at: ${p.bash("find src -name '*.ts' 2>/dev/null | head -50 || echo 'no src dir'")}.
For each file path, call auditLineLengths to get per-file statistics.
Return the declared output.`,
  output: s.object({
    files: s.record(s.object({
      avgLength: s.number,
      maxLength: s.number,
      longLineCount: s.number,
      veryLongLineCount: s.number,
    })),
    totalFiles: s.number,
    globalMaxLength: s.number,
    mostVerboseFile: s.optional(s.string),
  }),
  tools: [auditLineLengths],
  addons: [repair()],
});

export default sourceLineLengthAuditor;
```
