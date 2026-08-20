# 437 - Git Reflog Summarizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyReflogAction = defineTool("classifyReflogAction", {
  description: "Classify a git reflog entry's action from its subject.",
  parameters: s.object({ subject: s.string }),
  handler({ subject }) {
    if (/^checkout:/i.test(subject)) return "checkout" as const;
    if (/^commit/i.test(subject)) return "commit" as const;
    if (/^merge/i.test(subject)) return "merge" as const;
    if (/^rebase/i.test(subject)) return "rebase" as const;
    if (/^reset/i.test(subject)) return "reset" as const;
    return "other" as const;
  },
});

// Agent role: Summarize git reflog entries by classifying each action type.
const gitReflogSummarizer = agent({
  model: "small",
  instructions: p`Retrieve git reflog entries: ${p.bash("git reflog --format=%H|%gs|%ar --max-count=50")}. Each line is hash|subject|age. Use classifyReflogAction on the subject of each entry. Return all entries with classifications plus totals.`,
  output: s.object({
    entries: s.array(s.object({
      hash: s.string,
      action: s.enum("checkout", "commit", "merge", "rebase", "reset", "other"),
      summary: s.string,
      age: s.string,
    })),
    totalEntries: s.int,
    mostFrequentAction: s.string,
  }),
  tools: [classifyReflogAction],
  addons: [repair()],
});

export default gitReflogSummarizer;
```
