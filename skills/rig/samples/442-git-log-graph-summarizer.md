# 442 - Git Log Graph Summarizer

```rig
import { agent, p, s, defineTool } from "rig";
import { steering } from "rig";

const parseGraphLine = defineTool("parseGraphLine", {
  description: "Classify a git log graph line as merge, commit, branch-point, or other",
  parameters: s.object({ line: s.string }),
  handler: ({ line }: { line: string }) => {
    if (/Merge/.test(line)) return "merge" as const;
    if (/\*/.test(line) && /[0-9a-f]{6,}/.test(line)) return "commit" as const;
    if (/[|\\\/]/.test(line) && !/[0-9a-f]{6,}/.test(line)) return "branch-point" as const;
    return "other" as const;
  },
});

// Agent role: Summarize the git log graph by classifying each line.
const gitLogGraphSummarizer = agent({
  model: "small",
  instructions: p`Analyze this git log graph: ${p.bash("git log --oneline --graph -20")}.
For each line, call parseGraphLine to classify it.
Return all classified lines with counts of merges, commits, and branch points.`,
  output: s.object({
    lines: s.array(s.object({
      type: s.enum("merge", "commit", "branch-point", "other"),
      hash: s.optional(s.string),
      message: s.optional(s.string),
    })),
    mergeCount: s.int,
    commitCount: s.int,
    branchPoints: s.int,
  }),
  tools: [parseGraphLine],
  addons: [steering()],
});

export default gitLogGraphSummarizer;
```
