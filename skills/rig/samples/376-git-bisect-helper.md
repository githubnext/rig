# 376 - Git Bisect Helper

```rig
import { agent, defineTool, p, s, steering } from "rig";

const selectMidpoint = defineTool("selectMidpoint", {
  description: "Select the midpoint commit from a range of commits for binary search",
  parameters: s.object({
    commits: s.array(s.string("commit hash oneline")),
  }),
  handler({ commits }) {
    if (commits.length === 0) return JSON.stringify({ hash: null, index: -1 });
    const mid = Math.floor(commits.length / 2);
    const line = commits[mid];
    const hash = line.split(" ")[0];
    return JSON.stringify({ hash, index: mid, total: commits.length });
  },
});

// Agent role: perform a simulated git bisect to identify a suspect bad commit.
const gitBisectHelper = agent({
  model: "small",
  maxTurns: 8,
  instructions: p`Perform a git bisect analysis on the recent commit history.

Recent commits:
${p.bash("git log --oneline -20 2>/dev/null || echo 'no git history available'")}

Use selectMidpoint to perform binary search steps over the commit list. Simulate a bisect by selecting midpoints to narrow down the suspect commit range. After enough steps (3-4), pick the most suspect commit based on the bisect pattern.

Return the results in the output schema.`,
  output: s.object({
    suspectCommit: s.optional(s.string),
    stepsRun: s.int,
    commitRange: s.object({
      start: s.string,
      end: s.string,
    }),
    confidence: s.enum("high", "medium", "low"),
  }),
  tools: [selectMidpoint],
  addons: [steering()],
});

export default gitBisectHelper;
```
