# sequential-commit-pipeline - Sequential Commit Pipeline

```rig
import { workflow, agent, p, s } from "rig";

// Agent role: collect recent git commits as structured data.
const commitCollector = agent({
  model: "small",
  output: s.object({
    commits: s.array(s.object({ hash: s.string, message: s.string })),
  }),
  instructions: p`Run ${p.bash("git log --oneline -20")} and parse each line into hash and message. Return the commits array.`,
});

// Agent role: classify each commit by conventional commit type.
const commitClassifier = agent({
  model: "small",
  input: s.object({
    commits: s.array(s.object({ hash: s.string, message: s.string })),
  }),
  output: s.object({
    classified: s.array(s.object({
      hash: s.string,
      message: s.string,
      type: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
  }),
  instructions: `Classify each commit by its conventional commit type prefix. feat → "feat", fix → "fix", chore/build/ci/refactor/test/style/perf → "chore", docs → "docs", everything else → "other". Return classified array.`,
});

// Agent role: aggregate classified commits into a summary record.
const commitAggregator = agent({
  model: "small",
  input: s.object({
    classified: s.array(s.object({
      hash: s.string,
      message: s.string,
      type: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
  }),
  output: s.object({
    summary: s.record(s.int),
    totalCommits: s.int,
    topCategory: s.string,
  }),
  instructions: `Count the number of commits per type. Return summary as a record of type→count, totalCommits, and topCategory (the type with the highest count).`,
});

// Workflow role: pipeline git commits through collection, classification, and aggregation.
export default workflow({
  meta: { name: "sequential-commit-pipeline", description: "Collect, classify, and aggregate git commits in sequence." },
  body: async ({ call }) => {
    const r1 = await call(commitCollector, "Collect recent commits.");
    if (!r1) return null;
    const r2 = await call(commitClassifier, { commits: r1.commits });
    if (!r2) return null;
    return call(commitAggregator, r2);
  },
});
```
