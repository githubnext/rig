# 141 - LOC Statistics Gatherer

```rig
import { agent, p, s, defineTool } from "rig";

const aggregateByExtension = defineTool("aggregateByExtension", {
  description: "Aggregate line counts and file counts by extension from wc -l output.",
  parameters: s.object({ wcOutput: s.string }),
  handler({ wcOutput }) {
    const lines = wcOutput.trim().split("\n");
    const result: Record<string, { lineCount: number; fileCount: number }> = {};
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const count = parseInt(match[1], 10);
      const file = match[2];
      const ext = file.includes(".") ? "." + file.split(".").pop()! : "(no-ext)";
      if (!result[ext]) result[ext] = { lineCount: 0, fileCount: 0 };
      result[ext].lineCount += count;
      result[ext].fileCount += 1;
    }
    return result;
  },
});

// Agent role: Gather lines-of-code statistics grouped by file extension.
const locStatisticsGatherer = agent({
  model: "small",
  instructions: p`Count lines of code across the workspace grouped by file extension.

Find source files and count lines:
${p.bash("find . -maxdepth 4 -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.md' \\) ! -path '*/node_modules/*' ! -path '*/.git/*' | xargs wc -l 2>/dev/null | tail -n +1")}

Use the aggregateByExtension tool to group by extension.
Classify each extension's complexity based on total lineCount:
- small: < 500, medium: 500-2000, large: 2000-10000, xlarge: > 10000
Return s.record output keyed by extension with lineCount, fileCount, and complexity.`,
  tools: [aggregateByExtension],
  output: s.record(
    s.object({
      lineCount: s.int,
      fileCount: s.int,
      complexity: s.enum("small", "medium", "large", "xlarge"),
    }),
  ),
});

export default locStatisticsGatherer;
```
