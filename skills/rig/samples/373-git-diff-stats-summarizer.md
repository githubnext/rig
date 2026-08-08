# 373 - Git Diff Stats Summarizer

```rig
import { agent, defineTool, p, s, repair } from "rig";

const classifyDiffEntry = defineTool("classifyDiffEntry", {
  description: "Classify a diff file entry as added, modified, deleted, or renamed based on its path and stats",
  parameters: s.object({
    path: s.string("file path from diff"),
    additions: s.int,
    deletions: s.int,
  }),
  handler({ path, additions, deletions }) {
    if (path.includes(" => ")) return "renamed" as const;
    if (additions > 0 && deletions === 0) return "added" as const;
    if (deletions > 0 && additions === 0) return "deleted" as const;
    return "modified" as const;
  },
});

// Agent role: summarize git diff stats between HEAD~1 and HEAD.
const diffStatsSummarizer = agent({
  model: "small",
  instructions: p`Analyze the git diff stats for the most recent commit:
${p.bash("git diff --numstat HEAD~1 HEAD 2>/dev/null || git diff --numstat HEAD 2>/dev/null || echo 'no diff available'")}

For each file entry, use classifyDiffEntry to determine its classification. Return the full structured summary.`,
  output: s.object({
    files: s.array(s.object({
      path: s.string,
      additions: s.int,
      deletions: s.int,
      classification: s.enum("added", "modified", "deleted", "renamed"),
    })),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostChangedFile: s.optional(s.string),
  }),
  tools: [classifyDiffEntry],
  addons: [repair()],
});

export default diffStatsSummarizer;
```
