import { agent, p, s, defineTool } from "rig";

const classifySize = defineTool("classifySize", {
  description: "Classify a package size into a tier based on kilobytes.",
  parameters: s.object({ sizeKb: s.number }),
  handler({ sizeKb }) {
    if (sizeKb < 10) return "tiny" as const;
    if (sizeKb < 100) return "small" as const;
    if (sizeKb < 500) return "medium" as const;
    if (sizeKb < 2000) return "large" as const;
    return "xlarge" as const;
  },
});

// Agent role: estimate NPM package publish size and classify it.
const npmPackageSizeEstimator = agent({
  model: "typecheck",
  instructions: p`Estimate the published NPM package size.

npm pack dry-run output:
${p.bash("npm pack --dry-run 2>&1")}

Parse the output to find:
1. The total package size in KB (look for "package size:" or "Tarball Details" lines).
2. The top individual files with their sizes.

Call classifySize with the estimatedSizeKb to get the sizeRating.
List the top files (up to 10) as topFiles array with path and sizeKb.
Write a brief recommendation about the package size.`,
  tools: [classifySize],
  output: s.object({
    estimatedSizeKb: s.number,
    topFiles: s.array(s.object({ path: s.string, sizeKb: s.number })),
    sizeRating: s.enum("tiny", "small", "medium", "large", "xlarge"),
    recommendation: s.string,
  }),
});

export default npmPackageSizeEstimator;
