import { agent, p, s, repair } from "rig";

// Agent role: inventory all git stashes, listing changed files and estimating staleness.
const gitStashInventoryV2 = agent({
  model: "typecheck",
  instructions: p`List all stashes with timestamps: ${p.bash("git stash list --format='%gd|%ci|%s' 2>/dev/null || echo 'no stashes'")}. For the first three stashes show changed files: ${p.bash("git stash show --name-only stash@{0} 2>/dev/null || true")} ${p.bash("git stash show --name-only stash@{1} 2>/dev/null || true")} ${p.bash("git stash show --name-only stash@{2} 2>/dev/null || true")}. Classify staleness by commit date: fresh (< 1 week), aging (1–4 weeks), stale (1–3 months), ancient (> 3 months).`,
  output: s.array(s.object({
    stashRef: s.string,
    description: s.string,
    changedFiles: s.array(s.string),
    staleness: s.enum("fresh", "aging", "stale", "ancient"),
  })),
  maxTurns: 5,
  addons: repair(),
});

export default gitStashInventoryV2;
