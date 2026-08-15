# 416 - Readme Badge Analyzer V2

```rig
import { agent, p, s, steering, defineTool } from "rig";

const parseBadge = defineTool("parseBadge", {
  description: "Parse a markdown badge/shield image link and classify it by type.",
  parameters: s.object({ badgeMarkdown: s.string }),
  handler: ({ badgeMarkdown }: { badgeMarkdown: string }) => {
    const urlMatch = badgeMarkdown.match(/https?:\/\/[^\s\)\"]+/);
    const url = urlMatch ? urlMatch[0] : "";
    const altMatch = badgeMarkdown.match(/!\[([^\]]*)\]/);
    const altText = altMatch ? altMatch[1] : "";
    const lower = url.toLowerCase();
    const type: "ci" | "coverage" | "version" | "license" | "other" =
      lower.includes("github/actions") || lower.includes("travis") || lower.includes("circleci") || lower.includes("github/workflow")
        ? "ci"
      : lower.includes("codecov") || lower.includes("coveralls")
        ? "coverage"
      : lower.includes("/v/") || lower.includes("npm") || lower.includes("pypi")
        ? "version"
      : lower.includes("license")
        ? "license"
      : "other";
    return { url, altText, type };
  },
});

// Agent role: Parse README.md badge links, classify each by type, and summarize badge coverage.
const readmeBadgeAnalyzerV2 = agent({
  model: "small",
  instructions: p`README.md contents:
${p.readOptional("README.md")}

Extract all markdown badge lines (lines containing ![ and shields.io or img.shields). Call parseBadge for each badge found. Return all badges with url, altText, and type. Set hasCiBadge true if any badge has type "ci".`,
  tools: [parseBadge],
  output: s.object({
    badges: s.array(s.object({
      url: s.string,
      altText: s.string,
      type: s.enum("ci", "coverage", "version", "license", "other"),
    })),
    totalBadges: s.int,
    hasCiBadge: s.boolean,
  }),
  addons: [steering()],
});

export default readmeBadgeAnalyzerV2;

```
