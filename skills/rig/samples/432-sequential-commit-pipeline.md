# 432 - Sequential Commit Pipeline

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Collect recent git commits from the repository.
const commitCollector = agent({
  model: "small",
  instructions: p`Collect recent commits: ${p.bash("git log --oneline -20")}. Return each as hash and message.`,
  output: s.object({
    commits: s.array(s.object({ hash: s.string, message: s.string })),
  }),
});

// Agent role: Classify each commit message into a conventional commit type.
const commitClassifier = agent({
  model: "small",
  input: s.object({ commits: s.array(s.object({ hash: s.string, message: s.string })) }),
  instructions: p`Classify each commit in the input as feat/fix/chore/docs/other. Return the hash and category for each.`,
  output: s.array(s.object({ hash: s.string, category: s.enum("feat", "fix", "chore", "docs", "other") })),
});

// Agent role: Aggregate classified commits into a summary report.
const commitAggregator = agent({
  model: "small",
  input: s.array(s.object({ hash: s.string, category: s.enum("feat", "fix", "chore", "docs", "other") })),
  instructions: p`Count how many commits fall into each category and identify the most frequent category.`,
  output: s.object({
    summary: s.record(s.int),
    totalCommits: s.int,
    topCategory: s.string,
  }),
});

// Workflow role: Sequential pipeline to collect, classify, and aggregate recent git commits.
export default workflow({
  meta: { name: "sequential-commit-pipeline", description: "Collect, classify, and aggregate recent git commits.", phases: ["Collect", "Classify", "Aggregate"] },
  body: async ({ call, phase }) => {
    phase("Collect");
    const collected = await call(commitCollector, "Collect recent commits.");
    if (!collected) return null;
    phase("Classify");
    const classified = await call(commitClassifier, { commits: collected.commits });
    if (!classified) return null;
    phase("Aggregate");
    return call(commitAggregator, classified);
  },
});
```
