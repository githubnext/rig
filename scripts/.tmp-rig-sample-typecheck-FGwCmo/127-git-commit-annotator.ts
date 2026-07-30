import { agent, p, s } from "rig";

// Agent role: summarize a single git commit into a category and impact rating
const commitSummarizer = agent({
  name: "commitSummarizer",
  model: "typecheck",
  instructions: p`Analyze the git commit message provided in the input and classify it.

Commit info: ${p.inputField("commitLine")}

Classify the commit into a category (feat, fix, chore, docs, refactor, test, perf).
Write a concise one-sentence summary.
Rate the impact as low, medium, or high based on likely scope of change.`,
  input: s.object({ commitLine: s.string }),
  output: s.object({
    category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
    summary: s.string,
    impact: s.enum("low", "medium", "high"),
  }),
});

// Agent role: annotate recent git commits with category, summary, and impact, writing a markdown report
const gitCommitAnnotator = agent({
  name: "gitCommitAnnotator",
  model: "typecheck",
  agents: { commitSummarizer },
  instructions: p`Annotate the 20 most recent git commits with category, summary, and impact.

Recent commits: ${p.bash("git log --oneline -20")}

For each commit line, delegate to the commitSummarizer subagent.
Collect all annotations and build a markdown report with a table of hash, category, summary, and impact.
Set totalAnnotated to the number of commits annotated.
The report field will be written to commit-annotations.md.

${p.writeOutput("report", "commit-annotations.md")}`,
  output: s.object({
    annotations: s.array(
      s.object({
        hash: s.string,
        original: s.string,
        category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
        summary: s.string,
        impact: s.enum("low", "medium", "high"),
      })
    ),
    report: s.string,
    totalAnnotated: s.int,
  }),
});

export default gitCommitAnnotator;
