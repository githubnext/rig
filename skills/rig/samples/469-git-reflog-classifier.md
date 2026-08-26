# 469 - Git Reflog Classifier

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: fetch recent git reflog entries and extract operation types.
const reflogFetcher = agent({
  name: "reflogFetcher",
  model: "small",
  instructions: p`Retrieve recent git reflog entries.
${p.bash("git reflog --format='%H|%gs|%ar' -50 2>/dev/null || echo 'no reflog'")}
Parse each line into hash, action description, and relativeTime. Return entries array.`,
  output: s.object({
    entries: s.array(s.object({
      hash: s.string,
      action: s.string,
      relativeTime: s.string,
    })),
  }),
});

// Agent role: classify reflog entries by operation type and produce a summary.
const reflogClassifier = agent({
  name: "reflogClassifier",
  model: "small",
  input: s.object({
    entries: s.array(s.object({ hash: s.string, action: s.string, relativeTime: s.string })),
  }),
  instructions: `Classify each reflog entry's action into: commit, merge, rebase, checkout, reset, cherry-pick, or other.
Count occurrences per type. Return classified entries array, typeCounts record, and mostFrequentOp.`,
  output: s.object({
    classified: s.array(s.object({
      hash: s.string,
      action: s.string,
      opType: s.enum("commit", "merge", "rebase", "checkout", "reset", "cherry-pick", "other"),
    })),
    typeCounts: s.record(s.int),
    mostFrequentOp: s.string,
  }),
});

// Workflow role: fetch and classify git reflog entries to understand recent repository activity.
export default workflow({
  meta: { name: "git-reflog-classifier", description: "Fetch and classify git reflog entries by operation type." },
  body: async ({ call, phase }) => {
    phase("Fetch");
    const fetched = await call(reflogFetcher, "fetch reflog");
    if (!fetched) return null;
    phase("Classify");
    return call(reflogClassifier, { entries: fetched.entries });
  },
});
```
