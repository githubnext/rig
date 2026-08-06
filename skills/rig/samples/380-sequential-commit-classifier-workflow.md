# 380 - Sequential Commit Classifier Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Collect recent git commits from the repository.
const commitCollector = agent({
  model: "small",
  instructions: p`Collect recent commits: ${p.bash("git log --oneline -10")}. Return each as hash and message.`,
  output: s.object({
    commits: s.array(s.object({ hash: s.string, message: s.string })),
  }),
});

// Agent role: Classify each commit message into a conventional commit category.
const commitClassifier = agent({
  model: "small",
  input: s.object({ commits: s.array(s.object({ hash: s.string, message: s.string })) }),
  instructions: p`Classify each commit in the input. Return the hash and category for each.`,
  output: s.array(s.object({ hash: s.string, category: s.enum("feat", "fix", "chore", "docs", "other") })),
});

// Agent role: Aggregate classified commits into a summary report.
const commitAggregator = agent({
  model: "small",
  input: s.array(s.object({ hash: s.string, category: s.enum("feat", "fix", "chore", "docs", "other") })),
  instructions: p`Count how many commits fall into each category and identify the top category.`,
  output: s.object({
    summary: s.record(s.int),
    totalCommits: s.int,
    topCategory: s.string,
  }),
});

// Workflow role: Pipeline three agents to collect, classify, and aggregate recent git commits.
export default workflow({
  meta: { name: "sequential-commit-classifier", description: "Collect, classify, and aggregate recent git commits.", phases: ["Collect", "Classify", "Aggregate"] },
  body: async ({ call, phase }) => {
    phase("Collect");
    const step1 = await call(commitCollector, "Collect recent commits.");
    if (!step1) return null;
    phase("Classify");
    const step2 = await call(commitClassifier, { commits: step1.commits });
    if (!step2) return null;
    phase("Aggregate");
    return call(commitAggregator, step2);
  },
});
```
