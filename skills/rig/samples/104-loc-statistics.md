# 104 - LOC Statistics

```rig
import { agent, p, s, defineTool } from "rig";

const aggregateByExtension = defineTool("aggregateByExtension", {
  description: "Parse wc -l output lines and aggregate total line count and file count by extension",
  parameters: s.object({ wcOutput: s.string }),
  handler({ wcOutput }) {
    const totals: Record<string, { lineCount: number; fileCount: number }> = {};
    for (const line of wcOutput.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const count = parseInt(match[1], 10);
      const path = match[2];
      if (path === "total") continue;
      const ext = path.includes(".") ? "." + path.split(".").pop() : "(no ext)";
      if (!totals[ext]) totals[ext] = { lineCount: 0, fileCount: 0 };
      totals[ext].lineCount += count;
      totals[ext].fileCount += 1;
    }
    return totals;
  },
});

// Agent role: gather lines-of-code statistics per file extension and classify complexity.
const locStatistics = agent({
  model: "small",
  instructions: p`Gather LOC statistics. First list files: ${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.md' -o -name '*.json' \\) | head -200")}. Then count lines: ${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.md' -o -name '*.json' \\) -exec wc -l {} + 2>/dev/null | tail -20")}. Use the aggregateByExtension tool to sum lines and files per extension. Classify each extension as small (<500 lines), medium (<2000), large (<10000), or xlarge (≥10000).`,
  output: s.record(s.object({
    lineCount: s.number,
    fileCount: s.number,
    complexity: s.enum("small", "medium", "large", "xlarge"),
  })),
  tools: [aggregateByExtension],
});

export default locStatistics;
```
