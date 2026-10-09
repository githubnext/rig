# 540 - Steering Nullable Commit

```rig
import { agent, p, repair, s, steering } from "rig";

// Agent role: report the most recent commit message, or null if there is none.
const lastCommit = agent({
  model: "small",
  maxTurns: 4,
  instructions: p`Run ${p.bash("git log -n 1 --pretty=format:'%s'")}. If the
    output is empty, return null for lastCommitMessage and 0 for commitCount.
    Otherwise return the commit subject as lastCommitMessage and 1 for
    commitCount.`,
  output: s.object({
    lastCommitMessage: s.nullable(s.string),
    commitCount: s.int,
  }),
  addons: [steering(), repair()],
});

export default lastCommit;
```
