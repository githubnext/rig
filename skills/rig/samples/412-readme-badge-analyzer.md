# 412 - README Badge Analyzer

```rig
import { agent, p, s, defineTool, steering } from "rig";

// Agent role: parse README.md badges and classify each by category.
const readmeBadgeAnalyzer = agent({
  model: "small",
  instructions: p`Analyze badge images in the README and classify each badge.

README content:
${p.readOptional("README.md", "")}

Call parseBadge for each markdown image badge you find (pattern: [![...](imgUrl)](link)).
Then return the declared output.`,
  tools: [
    defineTool("parseBadge", {
      description: "Parse a badge URL and classify it as ci, coverage, version, license, or other",
      parameters: s.object({ url: s.string, label: s.string }),
      handler({ url, label }: { url: string; label: string }) {
        const u = url.toLowerCase();
        const l = label.toLowerCase();
        let category: "ci" | "coverage" | "version" | "license" | "other" = "other";
        if (/github.*action|travis|circleci|appveyor|workflow|build/.test(u + l)) category = "ci";
        else if (/coverage|codecov|coveralls/.test(u + l)) category = "coverage";
        else if (/version|release|npm|pypi/.test(u + l)) category = "version";
        else if (/license|mit|apache|gpl/.test(u + l)) category = "license";
        return { url, label, category };
      },
    }),
  ],
  output: s.object({
    badges: s.array(s.object({
      url: s.string,
      label: s.string,
      category: s.enum("ci", "coverage", "version", "license", "other"),
    })),
    totalBadges: s.int,
    hasCiBadge: s.boolean,
  }),
  addons: [steering()],
});

export default readmeBadgeAnalyzer;

```
