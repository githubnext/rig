import { agent, defineTool, p, s, steering } from "rig";

// Agent role: identify hot-spot files by git churn and classify risk level.
const gitHotspotAnalyzerV3 = agent({
  model: "typecheck",
  addons: steering({ message: "Focus on files that appear most frequently. Assign riskLevel based on churnScore: >20=critical, >10=high, >5=medium, else low." }),
  instructions: p`Analyze git history to find frequently changed files and classify their risk.

Recently changed files (with churn counts):
${p.bash("git log --name-only --format='' HEAD~50..HEAD | grep -v '^$' | sort | uniq -c | sort -rn | head -30")}

Top contributors overall:
${p.bash("git shortlog -sn HEAD~50..HEAD 2>/dev/null | head -10")}

Use the countChurn tool to parse the churn output for each file. For each file, determine
the churnScore, assign topContributors from the shortlog output, and classify riskLevel.
Return a record keyed by file path with the declared output shape.`,
  tools: [
    defineTool("countChurn", {
      description: "Parse a line of uniq -c output to extract count and filename",
      parameters: s.object({ line: s.string }),
      handler({ line }) {
        const m = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!m) return { count: 0, file: "" };
        return { count: parseInt(m[1], 10), file: m[2].trim() };
      },
    }),
  ],
  output: s.record(
    s.object({
      churnScore: s.int,
      topContributors: s.array(s.string),
      riskLevel: s.enum("low", "medium", "high", "critical"),
    })
  ),
});

export default gitHotspotAnalyzerV3;
