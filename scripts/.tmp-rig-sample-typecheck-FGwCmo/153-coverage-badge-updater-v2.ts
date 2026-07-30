import { agent, p, s } from "rig";

// Agent role: read coverage summary and update README with shields.io badge links.
const coverageBadgeUpdaterV2 = agent({
  model: "typecheck",
  instructions: p`Read coverage data and update the README with shields.io coverage badges.

Coverage summary (JSON):
${p.readOptional("coverage/coverage-summary.json", "{}")}

Current README:
${p.readOptional("README.md", "# Project\n")}

Compute the coverage percentage for each category (statements, branches, functions, lines)
from the total section. Compute overallPct as the average. Classify rating: green >= 80%,
yellow >= 60%, red < 60%.

Generate shields.io badge markdown for each category using URL format:
https://img.shields.io/badge/coverage-XX%25-green

Write the updated README with badges added at the top using p.write.

${p.write("README.md", "<!-- badges will be written by agent -->")}

Return coverageByCategory (record of category to percentage), overallPct, rating, and
badgesWritten (true if README was updated).`,
  output: s.object({
    coverageByCategory: s.record(s.number),
    overallPct: s.number,
    rating: s.enum("green", "yellow", "red"),
    badgesWritten: s.boolean,
  }),
});

export default coverageBadgeUpdaterV2;
