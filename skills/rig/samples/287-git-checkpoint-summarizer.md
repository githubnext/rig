# 287 - Git Checkpoint Summarizer

```rig
import { agent, defineTool, p, s } from "rig";

const classifyCheckpoint = defineTool("classifyCheckpoint", {
  description: "Classify a git checkpoint line as stash, commit, tag, or branch.",
  parameters: s.object({ line: s.string }),
  handler({ line }: { line: string }) {
    if (line.startsWith("stash@{")) return "stash" as const;
    if (/^refs\/tags\//.test(line)) return "tag" as const;
    if (/^refs\/heads\//.test(line)) return "branch" as const;
    return "commit" as const;
  },
});

// Agent role: summarize git checkpoints (stashes and recent commits) in the repository.
const gitCheckpointSummarizer = agent({
  model: "small",
  instructions: p`Summarize the git checkpoints (stashes and recent commits) for this repository.

Stash list:
${p.bash("git stash list 2>/dev/null || echo '(no stashes)'")}

Recent commits:
${p.bash("git log --oneline -20 2>/dev/null || echo '(no commits)'")}

For each stash entry and each commit line, call classifyCheckpoint to determine its type. Build the checkpoints array with ref, type, and message fields. Set latestCheckpoint to the most recent commit hash or stash ref, and totalCount to the combined count.`,
  tools: [classifyCheckpoint],
  output: s.object({
    checkpoints: s.array(
      s.object({
        ref: s.string,
        type: s.enum("stash", "commit", "tag", "branch"),
        message: s.string,
      })
    ),
    latestCheckpoint: s.optional(s.string),
    totalCount: s.int,
  }),
});

export default gitCheckpointSummarizer;
```
