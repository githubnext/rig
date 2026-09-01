# 504 - Git Reflog Inspector

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyReflogEntry = defineTool("classifyReflogEntry", {
  description: "Classify a single git reflog entry line",
  parameters: s.object({ line: s.string }),
  handler: ({ line }: { line: string }) => {
    const hashMatch = line.match(/^([0-9a-f]+)/);
    const hash = hashMatch ? hashMatch[1] : "";
    const lower = line.toLowerCase();
    let action: "commit" | "merge" | "rebase" | "reset" | "checkout" | "other" = "other";
    if (lower.includes("merge")) action = "merge";
    else if (lower.includes("rebase")) action = "rebase";
    else if (lower.includes("reset")) action = "reset";
    else if (lower.includes("checkout")) action = "checkout";
    else if (lower.includes("commit")) action = "commit";
    return { hash, action };
  },
});

// Agent role: Inspect the last 50 git reflog entries, classify each action, and return counts.
const gitReflogInspector = agent({
  model: "small",
  instructions: p`Inspect git reflog: ${p.bash("git reflog --oneline -50 2>/dev/null || echo 'no reflog'")}. 
For each line, call classifyReflogEntry to get the hash and action.
Return the declared output.`,
  output: s.object({
    entries: s.array(s.object({
      hash: s.string,
      action: s.enum("commit", "merge", "rebase", "reset", "checkout", "other"),
      message: s.string,
    })),
    actionCounts: s.record(s.number),
    totalEntries: s.number,
  }),
  tools: [classifyReflogEntry],
  addons: [steering()],
});

export default gitReflogInspector;
```
