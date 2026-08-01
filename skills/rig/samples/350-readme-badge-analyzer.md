# 350 - Readme Badge Analyzer

```rig
import { agent, p, s, defineTool, steering } from "rig";

// Agent role: Parse README.md badges, classify each by type, and report badge coverage.
const readmeBadgeAnalyzer = agent({
  model: "small",
  instructions: p`You are a README badge analyzer.

README content:
${p.readOptional("README.md")}

${defineTool("parseBadge", {
  description: "Parse a markdown badge and classify it by type",
  parameters: s.object({ markdownBadge: s.string }),
  handler: (args) => {
    const urlMatch = args.markdownBadge.match(/https?:\/\/[^\)]+/);
    const url = urlMatch ? urlMatch[0] : "";
    const labelMatch = args.markdownBadge.match(/\[([^\]]+)\]/);
    const label = labelMatch ? labelMatch[1] : "";
    const type =
      url.includes("github/workflow") || url.includes("actions") || url.includes("travis") ? "ci" as const
      : url.includes("codecov") || url.includes("coveralls") || url.includes("coverage") ? "coverage" as const
      : (url.includes("npm") && url.includes("/v/")) || url.includes("badge/version") ? "version" as const
      : url.includes("license") ? "license" as const
      : "other" as const;
    return { url, label, type };
  },
})}

Extract all badges from the README, classify each, and return the structured result.`,
  output: s.object({
    badges: s.array(s.object({
      label: s.string,
      url: s.string,
      type: s.enum("ci", "coverage", "version", "license", "other"),
    })),
    totalBadges: s.int,
    hasCiBadge: s.boolean,
  }),
  addons: [steering()],
});

export default readmeBadgeAnalyzer;
```
