import { agent, p, s, steering, repair } from "rig";

// Agent role: rewrite recent git commit messages into conventional commit format with imperative mood.
const commitMsgRewriter = agent({
  model: "typecheck",
  instructions: p`Review recent commits from ${p.bash("git log --oneline -20 2>/dev/null || echo 'no commits'")} and rewrite each message in conventional commit format with imperative mood (e.g. "Add feature" not "Added feature"). Classify each by category.`,
  output: s.array(s.object({
    hash: s.string,
    original: s.string,
    revised: s.string,
    category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
  })),
  maxTurns: 6,
  addons: [steering({ message: "Use imperative mood and conventional commit prefixes." }), repair()],
});

export default commitMsgRewriter;
