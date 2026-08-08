# 374 - Git Checkpoint Summarizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyCheckpoint = defineTool("classifyCheckpoint", {
  description: "Classify a git checkpoint string as stash, commit, tag, or branch.",
  parameters: s.object({ ref: s.string }),
  handler({ ref }) {
    if (ref.startsWith("stash@")) return "stash" as const;
    if (/^v?\d+\.\d+/.test(ref)) return "tag" as const;
    if (/^[0-9a-f]{7,40}/.test(ref.split(" ")[0])) return "commit" as const;
    return "branch" as const;
  },
});

// Agent role: Summarize git stash and commit checkpoints in the repository.
const gitCheckpointSummarizer = agent({
  model: "small",
  instructions: p`Review git checkpoints:
Stash list: ${p.bash("git stash list")}
Recent commits: ${p.bash("git log --oneline -10")}

Use classifyCheckpoint to classify each entry and return a summary.`,
  output: s.object({
    checkpoints: s.array(s.object({ ref: s.string, type: s.enum("stash", "commit", "tag", "branch"), message: s.string })),
    latestCheckpoint: s.optional(s.string),
    totalCount: s.int,
  }),
  tools: [classifyCheckpoint],
  addons: [repair()],
});

export default gitCheckpointSummarizer;
```
