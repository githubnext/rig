import { agent, defineTool, p, s, steering } from "rig";

const classifyComplexity = defineTool("classifyComplexity", {
  description: "Classify a file's complexity tier based on its line count",
  parameters: s.object({ lineCount: s.int }),
  handler({ lineCount }) {
    if (lineCount < 50) return { tier: "trivial" as const };
    if (lineCount < 150) return { tier: "small" as const };
    if (lineCount < 300) return { tier: "medium" as const };
    if (lineCount < 600) return { tier: "large" as const };
    return { tier: "huge" as const };
  },
});

// Agent role: analyze TypeScript source files by line count and classify their complexity.
const sourceComplexityHeatmap = agent({
  model: "typecheck",
  instructions: p`You are a source complexity heatmap generator.

TypeScript source file line counts (sorted descending):
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | xargs wc -l 2>/dev/null | sort -rn | grep -v total || true")}

For each file (skip the "total" summary line), use the classifyComplexity tool to assign a tier.
Build a record keyed by file path with lineCount and tier.
List hotspot files (tier "large" or "huge") as an array.
Sum all line counts for totalLines and name the single largest file as largestFile.`,
  tools: [classifyComplexity],
  addons: [steering({ message: "Ensure every file in the wc output is represented before finalizing." })],
  output: s.object({
    files: s.record(s.object({
      lineCount: s.int,
      tier: s.enum("trivial", "small", "medium", "large", "huge"),
    })),
    hotspots: s.array(s.path),
    totalLines: s.int,
    largestFile: s.path,
  }),
});

export default sourceComplexityHeatmap;
