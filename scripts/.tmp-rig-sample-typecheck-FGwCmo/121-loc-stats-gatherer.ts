import { agent, p, s, defineTool } from "rig";

const countLinesByExtension = defineTool("countLinesByExtension", {
  description: "Count total lines for files with a given extension",
  parameters: s.object({ extension: s.string }),
  handler: async ({ extension }) => {
    const { execSync } = await import("node:child_process");
    try {
      const result = execSync(
        `find . -type f -name "*.${extension}" -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | tail -1`,
        { encoding: "utf8" }
      );
      return result.trim();
    } catch {
      return "0";
    }
  },
});

// Agent role: gather lines-of-code statistics per file extension and rate the overall complexity
const locStatsGatherer = agent({
  name: "locStatsGatherer",
  model: "typecheck",
  instructions: p`Gather lines-of-code statistics for this workspace.

File extension counts: ${p.bash("find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20")}

TypeScript files: ${p.bash("find . -type f -name '*.ts' -not -path '*/node_modules/*' | head -100")}

Total line count: ${p.bash("find . -type f -name '*.ts' -not -path '*/node_modules/*' | xargs wc -l 2>/dev/null | tail -1")}

Use the countLinesByExtension tool to get line counts for the top extensions.
Compute byExtension record with fileCount and lineCount per extension.
Set complexityRating based on totalLines: small (<1000), medium (1000–10000), large (10000–100000), xlarge (100000+).`,
  output: s.object({
    byExtension: s.record(s.object({ fileCount: s.int, lineCount: s.int })),
    totalLines: s.int,
    largestExtension: s.string,
    complexityRating: s.enum("small", "medium", "large", "xlarge"),
  }),
  tools: [countLinesByExtension],
});

export default locStatsGatherer;
