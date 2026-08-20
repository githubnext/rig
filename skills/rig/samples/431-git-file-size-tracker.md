# 431 - Git File Size Tracker

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { execSync } from "node:child_process";

const getFileSizeAtRevision = defineTool("getFileSizeAtRevision", {
  description: "Get the byte size of a file at a specific git revision.",
  parameters: s.object({ revision: s.string, filePath: s.string }),
  handler({ revision, filePath }: { revision: string; filePath: string }) {
    try {
      const size = parseInt(
        execSync(`git cat-file -s ${revision}:${filePath} 2>/dev/null || echo '0'`, { encoding: "utf-8" }).trim(),
        10
      );
      return { size: isNaN(size) ? 0 : size };
    } catch {
      return { size: 0 };
    }
  },
});

// Agent role: track file size changes between the previous commit and HEAD.
const gitFileSizeTracker = agent({
  model: "small",
  instructions: p`Track file size changes between the previous commit and HEAD.

Files changed in the last commit:
${p.bash("git diff --name-only HEAD~1 HEAD 2>/dev/null || echo ''")}

For each changed file, call getFileSizeAtRevision with revision "HEAD~1" and again with "HEAD".
Compute delta = currentSize - previousSize.
Classify change as "grew" if delta > 0, "shrank" if delta < 0, "unchanged" if delta == 0.
Set largestGrowth to the path with highest positive delta (omit if none grew).
Set largestShrink to the path with most negative delta (omit if none shrank).`,
  output: s.object({
    files: s.array(
      s.object({
        path: s.path,
        previousSize: s.int,
        currentSize: s.int,
        delta: s.int,
        change: s.enum("grew", "shrank", "unchanged"),
      })
    ),
    totalFiles: s.int,
    largestGrowth: s.optional(s.string),
    largestShrink: s.optional(s.string),
  }),
  tools: [getFileSizeAtRevision],
  addons: [repair()],
});

export default gitFileSizeTracker;
```
