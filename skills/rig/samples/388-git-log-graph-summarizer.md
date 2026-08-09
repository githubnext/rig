# 388 - Git Log Graph Summarizer

```rig
import { agent, p, s, defineTool, steering } from "rig";

const parseGraphLine = defineTool("parseGraphLine", {
  description: "Parse a git log --graph line and classify its type",
  parameters: s.object({
    line: s.string,
  }),
  handler: ({ line }: { line: string }) => {
    const hashMatch = line.match(/\b([0-9a-f]{7,})\b/);
    const hash = hashMatch?.[1];
    const messageMatch = line.match(/[0-9a-f]{7,}\s+(.+)$/);
    const message = messageMatch?.[1];

    if (/Merge/.test(line) && hash) return { type: "merge" as const, hash, message };
    if (hash) return { type: "commit" as const, hash, message };
    if (/[|\\\/]/.test(line) && !hash) return { type: "branch-point" as const, hash: undefined, message: undefined };
    return { type: "decoration" as const, hash: undefined, message: undefined };
  },
});

// Agent role: Parse and summarize a git log graph output to extract commit, merge, and branch-point counts.
const gitLogGraphSummarizer = agent({
  model: "small",
  instructions: p`You are a git log graph summarizer.
Git log graph: ${p.bash("git log --oneline --graph -20 2>/dev/null || echo 'no git log available'")}

For each line of the graph output, call parseGraphLine to classify it.
Count merges, commits, and branch-points.
Return the output schema.`,
  output: s.object({
    lines: s.array(s.object({
      type: s.enum("merge", "commit", "branch-point", "decoration"),
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
