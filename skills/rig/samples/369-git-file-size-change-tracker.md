# 369 - Git File Size Change Tracker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const getFileSizeAtRevision = defineTool("getFileSizeAtRevision", {
  description: "Get the byte size of a file at a specific git revision.",
  parameters: { revision: s.string, filePath: s.string },
  handler: ({ revision, filePath }: { revision: string; filePath: string }) => {
    const { execSync } = require("node:child_process");
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

const gitFileSizeChangeTracker = agent({
  model: "small",
  instructions: p`Track file size changes between the previous commit and HEAD.

Files changed in the last commit:
${p.bash("git diff --name-only HEAD~1 HEAD 2>/dev/null || echo ''")}

Steps:
1. For each changed file path, call getFileSizeAtRevision twice: once with revision "HEAD~1" and once with "HEAD".
2. Compute delta = currentSize - previousSize.
3. Classify change: "grew" if delta > 0, "shrank" if delta < 0, "unchanged" if delta == 0.
4. Build files array with path, previousSize, currentSize, delta, change.
5. totalFiles = files.length.
6. largestGrowth = path with the highest positive delta (omit if none grew).
7. largestShrink = path with the most negative delta (omit if none shrank).`,
  output: s.object({
    files: s.array(
      s.object({
        path: s.string,
        previousSize: s.number,
        currentSize: s.number,
        delta: s.number,
        change: s.enum("grew", "shrank", "unchanged"),
      })
    ),
    totalFiles: s.number,
    largestGrowth: s.optional(s.string),
    largestShrink: s.optional(s.string),
  }),
  tools: [getFileSizeAtRevision],
  addons: [repair()],
});

export default gitFileSizeChangeTracker;
```
