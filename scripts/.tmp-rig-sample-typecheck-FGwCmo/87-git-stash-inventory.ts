import { agent, p, s } from "rig";

// Agent role: inventory all git stashes with their descriptions, changed files, and staleness classification.
const gitStashInventory = agent({
  model: "typecheck",
  instructions: p`List all git stashes: ${p.bash("git stash list 2>/dev/null || echo 'No stashes found'")}. For each stash entry shown, show its changed files: ${p.bash("git stash show --name-only 2>/dev/null || true")}. For each stash, classify its staleness as: fresh (< 1 week), aging (1-4 weeks), stale (1-3 months), ancient (> 3 months) based on the date shown in the stash list.`,
  output: s.array(s.object({
    stashRef: s.string,
    description: s.string,
    changedFiles: s.array(s.string),
    staleness: s.enum("fresh", "aging", "stale", "ancient"),
  })),
});

export default gitStashInventory;
