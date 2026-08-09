# 386 - Git Bisect Helper

```rig
import { agent, p, s, defineTool, steering } from "rig";

const selectMidpoint = defineTool("selectMidpoint", {
  description: "Select the midpoint commit hash from a list of commit hashes for binary search",
  parameters: s.object({
    commits: s.array(s.string),
  }),
  handler: ({ commits }: { commits: string[] }) => {
    if (commits.length === 0) return null;
    return commits[Math.floor(commits.length / 2)];
  },
});

// Agent role: Help identify a suspect commit using binary search over the recent git log.
const gitBisectHelper = agent({
  model: "small",
  instructions: p`You are a git bisect helper that uses binary search to find a suspect commit.
Recent git log: ${p.bash("git log --oneline -20 2>/dev/null || echo 'no git log available'")}

Use the selectMidpoint tool to identify candidate commits step by step.
Perform up to 8 binary search steps over the commit list.
After narrowing down, return your best suspect commit, how many steps you took,
the commit range you searched, and your confidence level.`,
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
  maxTurns: 8,
  addons: [steering()],
});

export default gitBisectHelper;
```
