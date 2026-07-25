# 143 - Coverage Badge Updater

```rig
import { agent, p, s } from "rig";

// Agent role: Update README.md with shields.io coverage badges from coverage summary JSON.
const coverageBadgeUpdater = agent({
  model: "small",
  instructions: p`Read the coverage summary and generate shields.io badge markdown.

Coverage summary:
${p.readOptional("coverage/coverage-summary.json", "{}")}

Compute coverage percentages per category (lines, statements, functions, branches) and overall.
Generate shields.io badge markdown URL for each category.
Classify overall coverage rating:
- green: >= 80%, yellow: 50-79%, red: < 50%

Write the badge summary markdown to README.md using the p.writeOutput intent below.
${p.writeOutput("badgeSummary", "README.md")}

Return coverageByCategory (record of percentages), overallPct, rating, badgesWritten, and badgeSummary.`,
  output: s.object({
    coverageByCategory: s.record(s.number),
    overallPct: s.number,
    rating: s.enum("green", "yellow", "red"),
    badgesWritten: s.boolean,
    badgeSummary: s.string,
  }),
});

export default coverageBadgeUpdater;
```
