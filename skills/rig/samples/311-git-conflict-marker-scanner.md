# 311 - Git Conflict Marker Scanner

```rig
import { agent, p, s, steering } from "rig";

// Agent role: scan tracked files for unresolved git conflict markers and report affected locations.
const gitConflictMarkerScanner = agent({
  model: "small",
  instructions: p`You are a git conflict marker scanner.

Check for conflict markers in tracked files:
${p.bash("git ls-files | xargs grep -lrn '<<<<<<< ' 2>/dev/null || echo 'no conflicts found'")}

For files with conflict markers, get the details:
${p.bash("git ls-files | xargs grep -n '^<<<<<<< \\|^=======$\\|^>>>>>>> ' 2>/dev/null || echo 'none'")}

Analyze the results and return the declared output listing all conflict markers found.`,
  output: s.object({
    conflicts: s.array(s.object({
      file: s.path,
      line: s.int,
      markerType: s.enum("start", "middle", "end"),
    })),
    affectedFiles: s.array(s.path),
    conflictCount: s.int,
    isClean: s.boolean,
  }),
  addons: [steering()],
});

export default gitConflictMarkerScanner;
```
