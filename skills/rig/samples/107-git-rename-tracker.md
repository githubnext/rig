# 107 - Git Rename Tracker

```rig
import { agent, p, s } from "rig";
import { repair } from "rig/addons";

// Agent role: track file renames in git history and produce a structured rename log.
const gitRenameTracker = agent({
  model: "small",
  instructions: p`Retrieve git file rename history: ${p.bash("git log --diff-filter=R --summary --pretty=format:'%h %ai' | head -60 2>/dev/null || echo 'No renames found'")}. Parse each rename entry (lines containing "rename from/to") and associate it with the commit hash and date from the preceding format line. Return an array of rename events sorted newest first.`,
  output: s.array(s.object({
    hash: s.string,
    date: s.string,
    oldPath: s.string,
    newPath: s.string,
  })),
  maxTurns: 4,
  addons: repair(),
});

export default gitRenameTracker;
```
