# 383 - Git Diff Stats Summarizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyDiffEntry = defineTool("classifyDiffEntry", {
  description: "Classify a git diff --numstat line as added, modified, deleted, or renamed",
  parameters: s.object({
    line: s.string,
  }),
  handler: ({ line }: { line: string }) => {
    if (line.startsWith("0\t")) return "added" as const;
    if (line.includes("\t") && line.split("\t")[0] !== "0" && line.split("\t")[1] !== "0") return "modified" as const;
    if (line.split("\t")[0] === "0") return "deleted" as const;
    if (line.includes("=>")) return "renamed" as const;
    return "modified" as const;
  },
});

// Agent role: Summarize git diff statistics between HEAD~1 and HEAD, classifying each changed file.
const gitDiffStatsSummarizer = agent({
  model: "small",
  instructions: p`You are a git diff statistics summarizer.
Run: ${p.bash("git diff --numstat HEAD~1 HEAD 2>/dev/null || git diff --numstat HEAD 2>/dev/null || echo 'no diff available'")}

For each output line, call classifyDiffEntry to get the category.
Parse additions and deletions counts from each line (format: additions deletions filepath).
Return the full output schema with all file stats.`,
  output: s.object({
    files: s.array(s.object({
      path: s.string,
      additions: s.int,
      deletions: s.int,
      category: s.enum("added", "modified", "deleted", "renamed"),
    })),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostChangedFile: s.optional(s.string),
  }),
  tools: [classifyDiffEntry],
  addons: [repair()],
});

export default gitDiffStatsSummarizer;
```
