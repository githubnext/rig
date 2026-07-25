# 111 - Conventional Commit Suggester

```rig
import { agent, p, s } from "rig";
import { repair, steering } from "rig/addons";

// Agent role: suggest conventional-format rewrites for recent git commit messages.
const conventionalCommitSuggester = agent({
  model: "mini",
  maxTurns: 6,
  addons: [steering({ message: "Ensure each suggestion follows the conventional commits spec: <type>(<scope>?): <description> using imperative mood." }), repair()],
  instructions: p`Review the recent git log and suggest conventional commit message rewrites:
${p.bash("git log --oneline -20")}

For each commit, identify the best category (feat/fix/chore/docs/test/refactor/style) and
rewrite the message to follow the conventional commits spec in imperative mood.
Write the full report to output. Return only the declared output.`,
  output: s.object({
    suggestions: s.array(
      s.object({
        hash: s.string,
        original: s.string,
        suggested: s.string,
        category: s.enum("feat", "fix", "chore", "docs", "test", "refactor", "style"),
      })
    ),
    totalReviewed: s.int,
  }),
});

export default conventionalCommitSuggester;
```
