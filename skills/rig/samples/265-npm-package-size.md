# 265 - NPM Package Size

```rig
import { agent, p, s, defineTool } from "rig";

// Agent role: estimate npm package publish size and rate it with a recommendation.
const npmPackageSize = agent({
  model: "small",
  instructions: p`Estimate the npm package publish size and rate it.

Files included in npm publish (dry run):
${p.bash("npm pack --dry-run 2>&1 | head -40")}

Workspace size:
${p.bash("du -sh . 2>/dev/null | cut -f1")}

Package metadata:
${p.readOptional("package.json", "{}")}

Parse the npm pack output to extract individual file sizes. Use classifySize on the total.
List the top files by size. Provide a recommendation if the package is large.
Return estimatedSizeKb, topFiles (up to 5), sizeRating, and recommendation.`,
  tools: [
    defineTool("classifySize", {
      description: "Classify a package size in KB into a rating tier.",
      parameters: s.object({ sizeKb: s.number }),
      handler({ sizeKb }) {
        if (sizeKb < 10) return { rating: "tiny" };
        if (sizeKb < 100) return { rating: "small" };
        if (sizeKb < 1000) return { rating: "medium" };
        if (sizeKb < 10000) return { rating: "large" };
        return { rating: "xlarge" };
      },
    }),
  ],
  output: s.object({
    estimatedSizeKb: s.number,
    topFiles: s.array(s.object({ path: s.path, sizeKb: s.number })),
    sizeRating: s.enum("tiny", "small", "medium", "large", "xlarge"),
    recommendation: s.string,
  }),
});

export default npmPackageSize;
```
