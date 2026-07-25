# 133 - Coverage Badge Updater

```rig
import { agent, p, s } from "rig";

// Agent role: read coverage summary and generate shields.io badge markdown, writing it to a coverage report file.
const coverageBadgeUpdater = agent({
  model: "small",
  instructions: p`Read coverage data and generate shields.io badge markdown.

Coverage summary: ${p.readOptional("coverage/coverage-summary.json", "{}")}

Current README: ${p.readOptional("README.md", "")}

Parse the coverage summary JSON. Extract per-category percentages for statements, branches, functions, and lines. Compute overallPct as the average. Set rating: green (>=80%), yellow (60–79%), red (<60%). Generate shields.io badge markdown for each category and the overall percentage. Write the badge markdown to the output field badgeMarkdown. Set badgesWritten to true after generating. ${p.writeOutput("badgeMarkdown", "coverage-badges.md")}`,
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
