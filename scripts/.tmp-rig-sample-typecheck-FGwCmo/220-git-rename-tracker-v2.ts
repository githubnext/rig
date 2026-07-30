import { agent, p, s, repair } from "rig";

// Agent role: track file renames in git history and produce a structured rename log.
const gitRenameTrackerV2 = agent({
  model: "typecheck",
  instructions: p`Retrieve git file rename history: ${p.bash("git log --diff-filter=R --summary --pretty=format:'%h %ai' | head -60 2>/dev/null || echo 'No renames found'")}. Parse each rename entry (lines matching "rename ... => ...") and associate it with the nearest commit hash and date. Return all renames sorted newest first, the total count, and the path that appears most often as either old or new.`,
  output: s.object({
    renames: s.array(s.object({
      hash: s.string,
      date: s.string,
      oldPath: s.path,
      newPath: s.path,
    })),
    totalRenames: s.int,
    mostRenamedFile: s.optional(s.path),
  }),
  maxTurns: 4,
  addons: repair(),
});

export default gitRenameTrackerV2;
