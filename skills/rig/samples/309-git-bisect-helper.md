# 309 - Git Bisect Helper

```rig
import { agent, p, s, defineTool, steering } from "rig";

const selectMidpoint = defineTool("selectMidpoint", {
  description: "Select the midpoint commit from a list for binary search bisection",
  parameters: s.object({ commits: s.array(s.string), currentBad: s.string, currentGood: s.string }),
  handler({ commits }) {
    if (commits.length === 0) return { midpoint: null, remaining: 0 };
    const mid = Math.floor(commits.length / 2);
    return { midpoint: commits[mid] ?? null, remaining: commits.length };
  },
});

// Agent role: Analyze recent git commit history to identify the most likely suspect commit for a regression using binary search logic.
const gitBisectHelper = agent({
  model: "small",
  maxTurns: 8,
  instructions: p`Analyze recent git commits to identify a suspect regression commit using binary search logic.

Recent commits (newest first):
${p.bash("git log --oneline -20 2>/dev/null | head -20 || echo 'no commits'")}

Commit count in range:
${p.bash("git log --oneline HEAD~10..HEAD 2>/dev/null | wc -l || echo '0'")}

Use the selectMidpoint tool to perform binary search steps over the commit list.
Assume HEAD is the bad commit and HEAD~10 is good.
Narrow down to the most likely suspect commit.
Set confidence based on how precisely the range was narrowed:
  high = 1 commit identified, medium = 2-3 candidates, low = 4+ or unknown.
Return suspectCommit (the SHA/oneline of the suspect), stepsRun, commitRange of the final narrowed set.`,
  output: s.object({
    suspectCommit: s.optional(s.string),
    stepsRun: s.int,
    commitRange: s.array(s.string),
    confidence: s.enum("high", "medium", "low"),
  }),
  tools: [selectMidpoint],
  addons: [steering()],
});

export default gitBisectHelper;
```
