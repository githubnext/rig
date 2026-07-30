import { agent, defineTool, p, s } from "rig";

const classifySize = defineTool("classifySize", {
  description: "Classify a package size in KB into a tier rating.",
  parameters: s.object({ sizeKb: s.number }),
  handler({ sizeKb }: { sizeKb: number }) {
    if (sizeKb < 10) return "tiny" as const;
    if (sizeKb < 100) return "small" as const;
    if (sizeKb < 500) return "medium" as const;
    if (sizeKb < 2000) return "large" as const;
    return "xlarge" as const;
  },
});

// Agent role: estimate the NPM package size and rate it by tier.
const npmPackageSizeEstimator = agent({
  model: "typecheck",
  instructions: p`Estimate the NPM package size for this project.

Pack dry-run output:
${p.bash("npm pack --dry-run 2>&1 | tail -20")}

Directory size:
${p.bash("du -sh . 2>/dev/null | head -5")}

Use classifySize tool with the estimated total size in KB to get the sizeRating.
List the top files by size and provide a brief recommendation.`,
  tools: [classifySize],
  output: s.object({
    estimatedSizeKb: s.number,
    topFiles: s.array(s.object({ name: s.string, sizeKb: s.number })),
    sizeRating: s.enum("tiny", "small", "medium", "large", "xlarge"),
    recommendation: s.string,
  }),
});

export default npmPackageSizeEstimator;
