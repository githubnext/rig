import { agent, p, s, repair } from "rig";

// Agent role: track file renames in recent git history and return a structured report.
const gitRenameTracker = agent({
  model: "typecheck",
  instructions: p`Analyze the following git log output for file renames:

${p.bash("git log --diff-filter=R --summary --oneline -50")}

Parse each rename line (format: "rename old/path => new/path (similarity%)").
Extract the commit hash from the preceding commit line, and the old and new paths.
Return the structured list of renames with totals.`,
  output: s.object({
    renames: s.array(s.object({
      hash: s.string,
      oldPath: s.path,
      newPath: s.path,
    })),
    totalRenames: s.int,
    mostRenamed: s.optional(s.path),
  }),
  addons: [repair()],
});

export default gitRenameTracker;
