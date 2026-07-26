# 101 - Commit Format Suggester 2

```rig
import { agent, p, s, repair, steering } from "rig";

// Agent role: suggest conventional commit format for recent git commit messages.
const commitFormatSuggester = agent({
  model: "small",
  instructions: p`Review the last 10 git commits: ${p.bash("git log --oneline -10")}. For each commit, determine its conventional category (feat/fix/chore/docs/test/refactor/style), then propose an improved commit message following the conventional commits spec. Return an array with one entry per commit.`,
  output: s.array(s.object({
    hash: s.string,
    original: s.string,
    suggested: s.string,
    category: s.enum("feat", "fix", "chore", "docs", "test", "refactor", "style"),
  })),
  maxTurns: 4,
  addons: [steering({ message: "Every commit must have a suggested message in conventional format." }), repair()],
});

export default commitFormatSuggester;
```
