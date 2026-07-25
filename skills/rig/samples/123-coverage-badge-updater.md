# 123 - Coverage Badge Updater

```rig
import { agent, p, s } from "rig";

// Agent role: read coverage data and generate shields.io badge markdown, writing it to a file
const coverageBadgeUpdater = agent({
  name: "coverageBadgeUpdater",
  model: "small",
  instructions: p`Read coverage data and generate badge markdown for README.

Coverage summary: ${p.readOptional("coverage/coverage-summary.json", "{}")}

Current README: ${p.read("README.md")}

Parse the coverage summary JSON. Extract per-category percentages (lines, statements, functions, branches).
Compute the overall percentage as the average.
Set rating: green (>=80%), yellow (60–79%), red (<60%).
Generate shields.io badge markdown for each category and overall.
Set badgesWritten to true.
The badgeMarkdown field will be written to coverage-badge.md.

${p.writeOutput("badgeMarkdown", "coverage-badge.md")}`,
  output: s.object({
    coverageByCategory: s.record(s.number),
    overallPct: s.number,
    rating: s.enum("green", "yellow", "red"),
    badgesWritten: s.boolean,
    badgeMarkdown: s.string,
  }),
});

export default coverageBadgeUpdater;
```
