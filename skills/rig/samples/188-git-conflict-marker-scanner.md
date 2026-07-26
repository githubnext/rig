# 188 - Git Conflict Marker Scanner

```rig
import { agent, p, s } from "rig";

// Agent role: scan the repository for git conflict markers and report affected files.
const gitConflictMarkerScanner = agent({
  model: "small",
  instructions: p`Scan for git conflict markers in tracked files: ${p.bash("grep -rn '<<<<<<< \\|=======$\\|>>>>>>> ' --include='*.ts' --include='*.js' --include='*.json' --include='*.md' --include='*.yaml' --include='*.yml' . 2>/dev/null | grep -v node_modules | head -100 || echo ''")}. Also check all text files: ${p.bash("grep -rn '^<<<<<<< ' . 2>/dev/null | grep -v node_modules | grep -v '.git' | head -50 || echo ''")}. For each match, extract the file path, line number, and which marker it is. Deduplicate affected file paths. Return all conflict locations, the unique affected files list, total count, and whether the repo is clean.`,
  output: s.object({
    conflicts: s.array(s.object({
      file: s.path,
      line: s.int,
      marker: s.enum("<<<<<<<", "=======", ">>>>>>>"),
    })),
    affectedFiles: s.array(s.path),
    conflictCount: s.int,
    isClean: s.boolean,
  }),
});

export default gitConflictMarkerScanner;
```
