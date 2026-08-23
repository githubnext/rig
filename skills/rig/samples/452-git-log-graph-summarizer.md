# 452 - Git Log Graph Summarizer

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const parseGraphLine = defineTool("parseGraphLine", {
  description: "Classify a git log graph line as merge, commit, or branch-point",
  parameters: s.object({ line: s.string }),
  handler: ({ line }: { line: string }): "merge" | "commit" | "branch-point" => {
    if (line.includes("Merge")) return "merge" as const;
    if (/\*/.test(line) && /[0-9a-f]{7}/.test(line)) return "commit" as const;
    return "branch-point" as const;
  },
});

// Agent role: Summarize the git log graph by classifying each line and counting merges, commits, and branch-points.
const gitLogGraphSummarizer = agent({
  model: "small",
  instructions: p`Analyze the following git log graph output: ${p.bash("git log --oneline --graph -20")}. For each line, call parseGraphLine to classify it. Return the structured summary.`,
  output: s.object({
    lines: s.array(s.object({
      type: s.enum("merge", "commit", "branch-point"),
      hash: s.optional(s.string),
      message: s.optional(s.string),
    })),
    mergeCount: s.int,
    commitCount: s.int,
    branchPoints: s.int,
  }),
  tools: [parseGraphLine],
  addons: [steering(), repair()],
});

export default gitLogGraphSummarizer;

```
