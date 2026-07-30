import { agent, p, s } from "rig";

// Agent role: summarize a single git commit line into a category and impact rating
const commitSummarizer = agent({
  name: "commitSummarizer",
  model: "typecheck",
  instructions: p`Analyze the git commit message provided in the input and classify it.

Commit info: ${p.inputField("commitLine")}

Classify into category (feat, fix, chore, docs, refactor, test, perf) and rate impact (low, medium, high).`,
  input: s.object({ commitLine: s.string }),
  output: s.object({
    category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
    impact: s.enum("low", "medium", "high"),
  }),
});

// Agent role: annotate recent git commits with category and impact via subagent delegation, writing a markdown report
const gitCommitAnnotator = agent({
  name: "gitCommitAnnotator",
  model: "typecheck",
  agents: { commitSummarizer },
  instructions: p`Annotate recent git commits using the commitSummarizer subagent.

Recent commits (hash + message):
${p.bash("git log --oneline -20")}

For each commit line, delegate to commitSummarizer with the full commit line as commitLine.
Collect the category and impact for every commit.
Build a markdown report table with columns: hash, message, category, impact.
Write the report to commit-annotations.md.
${p.writeOutput("report", "commit-annotations.md")}`,
  output: s.object({
    annotations: s.array(
      s.object({
        hash: s.string,
        message: s.string,
        category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
        impact: s.enum("low", "medium", "high"),
      })
    ),
    report: s.string,
  }),
});

export default gitCommitAnnotator;
