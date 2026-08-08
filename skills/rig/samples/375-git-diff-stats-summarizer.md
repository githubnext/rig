# 375 - Git Diff Stats Summarizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyDiffEntry = defineTool("classifyDiffEntry", {
  description: "Classify a git diff --numstat entry as added, modified, deleted, or renamed.",
  parameters: { additions: s.int, deletions: s.int, path: s.string },
  handler: ({ additions, deletions, path }: { additions: number; deletions: number; path: string }) => {
    let changeType: "added" | "modified" | "deleted" | "renamed" = "modified";
    if (path.includes(" => ") || path.includes("{")) changeType = "renamed";
    else if (deletions === 0 && additions > 0) changeType = "added";
    else if (additions === 0 && deletions > 0) changeType = "deleted";
    return { changeType } as const;
  },
});

// Agent role: summarize git diff statistics between HEAD~1 and HEAD.
const gitDiffStatsSummarizer = agent({
  model: "small",
  instructions: p`Summarize file changes between the last two commits.

Diff numstat output:
${p.bash("git diff --numstat HEAD~1 HEAD 2>/dev/null || echo ''")}

Steps:
1. Parse each line of the numstat output (format: additions TAB deletions TAB path).
2. For each entry, call classifyDiffEntry with additions, deletions, path to get changeType.
3. Build files array with path, additions, deletions, changeType.
4. totalAdditions = sum of all additions.
5. totalDeletions = sum of all deletions.
6. mostChangedFile = path with highest additions+deletions (omit if no files).`,
  output: s.object({
    files: s.array(
      s.object({
        path: s.string,
        additions: s.int,
        deletions: s.int,
        changeType: s.enum("added", "modified", "deleted", "renamed"),
      })
    ),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostChangedFile: s.optional(s.string),
  }),
  tools: [classifyDiffEntry],
  addons: [repair()],
});

export default gitDiffStatsSummarizer;
```
