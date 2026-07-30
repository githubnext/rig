import { agent, p, s, repair } from "rig";

// Agent role: track file renames in git history and produce a structured rename log.
const gitRenameTracker = agent({
  model: "typecheck",
  instructions: p`Retrieve git file rename history: ${p.bash("git log --diff-filter=R --summary --pretty=format:'%H %ci' 2>/dev/null | head -80 || echo 'no renames'")}. Parse each rename entry — lines starting with "rename from/to" — and associate each pair with the commit hash and ISO date from the preceding format line. Return an array sorted newest first, with at most 20 entries.`,
  output: s.array(s.object({
    hash: s.string,
    date: s.string,
    oldPath: s.string,
    newPath: s.string,
  })),
  maxTurns: 2,
  addons: repair(),
});

export default gitRenameTracker;
