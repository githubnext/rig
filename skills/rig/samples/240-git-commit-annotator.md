# 240 - Git Commit Annotator

```rig
import { agent, p, s } from "rig";

// Agent role: annotate each of the last 20 git commits with a category and impact level.
const commitSummarizer = agent({
  name: "commitSummarizer",
  model: "small",
  instructions: p`Classify the following git commit line into a category and impact level.
Commit: ${p.readInput("commit")}`,
  input: s.object({ commit: s.string }),
  output: s.object({
    category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
    impact: s.enum("low", "medium", "high"),
  }),
});

// Agent role: fetch the last 20 git commits and annotate each with category and impact using the commitSummarizer subagent.
const gitCommitAnnotator = agent({
  model: "small",
  instructions: p`You are a git commit annotator. Here are the last 20 commits:
${p.bash("git log --oneline -20")}

For each commit line, call the commitSummarizer subagent with the full commit line.
Then assemble the annotations array and a short prose report summarizing the distribution of categories and impacts.`,
  output: s.object({
    annotations: s.array(s.object({
      hash: s.string,
      message: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "refactor", "test", "perf"),
      impact: s.enum("low", "medium", "high"),
    })),
    report: s.string,
  }),
  agents: { commitSummarizer },
});

export default gitCommitAnnotator;
```
