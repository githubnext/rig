# 158 - Npm Package Size

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: estimate npm package publish size and rate it with a recommendation.
const npmPackageSize = agent({
  model: "small",
  instructions: p`Estimate the npm package publish size and provide a recommendation.

Files that would be included in npm publish (dry run):
${p.bash("npm pack --dry-run 2>&1 | head -40")}

Overall workspace size:
${p.bash("du -sh . 2>/dev/null | cut -f1")}

Package metadata:
${p.readOptional("package.json", "{}")}

Parse the npm pack output to extract file sizes. Use the classifySize tool to rate the
total estimated size. Provide a recommendation based on the rating (e.g., suggest adding
files to .npmignore if large/xlarge).

Return estimatedSizeKb (total in KB), topFiles (up to 5 largest files with file and
sizeKb), sizeRating, and a recommendation string.`,
  tools: [
    defineTool("classifySize", {
      description: "Classify a package size in KB into a rating tier",
      parameters: s.object({ sizeKb: s.number }),
      handler({ sizeKb }) {
        if (sizeKb < 10) return { rating: "tiny" };
        if (sizeKb < 50) return { rating: "small" };
        if (sizeKb < 200) return { rating: "medium" };
        if (sizeKb < 1000) return { rating: "large" };
        return { rating: "xlarge" };
      },
    }),
  ],
  output: s.object({
    estimatedSizeKb: s.number,
    topFiles: s.array(s.object({ file: s.string, sizeKb: s.number })),
    sizeRating: s.enum("tiny", "small", "medium", "large", "xlarge"),
    recommendation: s.string,
  }),
});

export default npmPackageSize;
```
