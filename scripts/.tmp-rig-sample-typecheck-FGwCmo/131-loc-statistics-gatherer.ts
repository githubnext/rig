import { agent, p, s, defineTool } from "rig";

const aggregateByExtension = defineTool("aggregateByExtension", {
  description: "Parse wc -l output and aggregate line and file counts by extension",
  parameters: s.object({ wcOutput: s.string }),
  handler: ({ wcOutput }) => {
    const totals: Record<string, { lineCount: number; fileCount: number }> = {};
    for (const line of wcOutput.trim().split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const count = parseInt(match[1], 10);
      const filePath = match[2];
      if (filePath === "total") continue;
      const ext = filePath.includes(".") ? "." + filePath.split(".").pop()! : "(none)";
      if (!totals[ext]) totals[ext] = { lineCount: 0, fileCount: 0 };
      totals[ext].lineCount += count;
      totals[ext].fileCount += 1;
    }
    return JSON.stringify(totals);
  },
});

// Agent role: gather lines-of-code statistics per file extension and classify overall complexity.
const locStatisticsGatherer = agent({
  model: "typecheck",
  instructions: p`Gather lines-of-code statistics for this repository. List files: ${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | head -200")}. Count lines per file: ${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f -exec wc -l {} + 2>/dev/null | tail -30")}. Use aggregateByExtension to sum lineCount and fileCount per extension. Compute complexityRating: small (<1000 total lines), medium (<5000), large (<20000), xlarge (>=20000).`,
  output: s.object({
    byExtension: s.record(s.object({
      lineCount: s.int,
      fileCount: s.int,
    })),
    complexityRating: s.enum("small", "medium", "large", "xlarge"),
  }),
  tools: [aggregateByExtension],
});

export default locStatisticsGatherer;
