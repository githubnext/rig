# 419 - Source Line Length Auditor

```rig
import { agent, defineTool, p, repair, s } from "rig";

const auditLineLengths = defineTool("auditLineLengths", {
  description: "Audit line lengths in a source file and return statistics.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    let totalLength = 0;
    let maxLength = 0;
    let longLineCount = 0;
    let veryLongLineCount = 0;
    for (const line of lines) {
      const len = line.length;
      totalLength += len;
      if (len > maxLength) maxLength = len;
      if (len > 120) veryLongLineCount++;
      else if (len > 80) longLineCount++;
    }
    const avgLength = lines.length > 0 ? totalLength / lines.length : 0;
    return { avgLength, maxLength, longLineCount, veryLongLineCount };
  },
});

// Agent role: audit line lengths across TypeScript source files and identify verbose files.
const sourceLineLengthAuditor = agent({
  model: "small",
  instructions: p`Audit line lengths across TypeScript source files.

Files:
${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null || echo '(none)'")}

For each .ts file found, call auditLineLengths with the file path. Build the files record keyed by file path. Compute totalFiles, globalMaxLength (max across all files), mostVerboseFile (path with highest maxLength, omit if no files found).`,
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
