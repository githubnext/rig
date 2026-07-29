# 291-npm-package-size-estimator - Npm Package Size Estimator

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifySize = defineTool("classifySize", {
  description: "Classify a package size in KB into a tier rating",
  parameters: s.object({ sizeKb: s.number }),
  handler: ({ sizeKb }) => {
    if (sizeKb < 50) return "tiny" as const;
    if (sizeKb < 200) return "small" as const;
    if (sizeKb < 500) return "medium" as const;
    if (sizeKb < 2000) return "large" as const;
    return "xlarge" as const;
  },
});

// Agent role: estimate the npm package size and classify it into a tier rating
const npmPackageSizeEstimator = agent({
  model: "small",
  instructions: p`Estimate this package's size using:
- Pack dry-run: ${p.bash("npm pack --dry-run 2>&1 | head -40")}
- Directory size: ${p.bash("du -sh . 2>/dev/null | head -5")}

Use the classifySize tool to determine the tier rating. Return estimatedSizeKb, topFiles (up to 5 files with their sizes), sizeRating, and a recommendation.`,
  output: s.object({
    estimatedSizeKb: s.number,
    topFiles: s.array(s.object({ name: s.string, sizeKb: s.number })),
    sizeRating: s.enum("tiny", "small", "medium", "large", "xlarge"),
    recommendation: s.string,
  }),
  tools: [classifySize],
  addons: [repair()],
});

export default npmPackageSizeEstimator;
```
