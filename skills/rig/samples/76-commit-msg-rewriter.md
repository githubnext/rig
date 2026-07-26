# 76 - Commit Msg Rewriter

```rig
import { agent, p, s, steering, repair } from "rig";

// Agent role: rewrite recent git commit messages into conventional commit format with imperative mood.
const commitMsgRewriter = agent({
  model: "small",
  instructions: p`Review recent commits from ${p.bash("git log --oneline -20 2>/dev/null || echo 'no commits'")} and rewrite each message in conventional commit format (feat:/fix:/chore:/docs:/test:/refactor:/style: prefix) with imperative mood. Write a markdown summary of all rewrites via ${p.writeOutput("markdown", "commit-rewrites.md")}`,
  output: s.object({
    rewrites: s.array(s.object({
      hash: s.string,
      original: s.string,
      revised: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "test", "refactor", "style"),
    })),
    markdown: s.string,
  }),
  maxTurns: 6,
  addons: [steering({ message: "Use imperative mood and conventional commit prefixes. Be consistent." }), repair()],
});

export default commitMsgRewriter;

```
