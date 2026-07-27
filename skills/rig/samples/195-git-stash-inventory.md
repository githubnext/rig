# 195 - Git Stash Inventory

```rig
import { agent, p, s } from "rig";

// Agent role: inventory all git stashes, listing changed files and classifying staleness.
const gitStashInventory = agent({
  model: "small",
  instructions: p`List all stashes: ${p.bash("git stash list 2>/dev/null || echo 'no stashes'")}. For each stash ref, show changed files: ${p.bash("git stash show --name-only 2>/dev/null || true")}. Classify staleness: fresh (< 1 week), aging (1–4 weeks), stale (1–3 months), ancient (> 3 months).`,
  output: s.array(s.object({
    stashRef: s.string,
    description: s.string,
    changedFiles: s.array(s.string),
    staleness: s.enum("fresh", "aging", "stale", "ancient"),
  })),
});

export default gitStashInventory;
```
