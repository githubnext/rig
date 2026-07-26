# 83 - Commit Format Suggester

```rig
import { agent, p, s } from "rig";

// Agent role: review recent git commits and suggest conventional-format rewrites for each one.
const commitFormatSuggester = agent({
  model: "small",
  instructions: p`Review recent git commits: ${p.bash("git log --oneline -20 --no-merges")}. For each commit, check whether its message follows conventional commit format (type: description). Suggest a rewritten message in conventional format. Classify each commit as one of: feat, fix, chore, docs, test, refactor, style. Write the full report to commit-report.md via ${p.writeOutput("reportWritten", "commit-report.md")}.`,
  output: s.array(s.object({
    hash: s.string,
    original: s.string,
    suggested: s.string,
    category: s.enum("feat", "fix", "chore", "docs", "test", "refactor", "style"),
  })),
  maxTurns: 5,
});

export default commitFormatSuggester;
```
