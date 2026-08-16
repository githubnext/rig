# 423 - Git File Size Tracker

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { execSync } from "node:child_process";

const getFileSizeAtRevision = defineTool("getFileSizeAtRevision", {
  description: "Get the byte size of a file at a specific git revision using git cat-file.",
  parameters: s.object({ revision: s.string, filePath: s.string }),
  handler({ revision, filePath }: { revision: string; filePath: string }) {
    try {
      const out = execSync(`git cat-file -s "${revision}:${filePath}" 2>/dev/null || echo 0`, { encoding: "utf-8" });
      const size = parseInt(out.trim(), 10);
      return { size: isNaN(size) ? 0 : size };
    } catch {
      return { size: 0 };
    }
  },
});

// Agent role: track file byte-size changes between HEAD~1 and HEAD.
const gitFileSizeTracker = agent({
  model: "small",
  instructions: p`Track file size changes between the previous commit (HEAD~1) and current HEAD.

Files changed in the last commit:
${p.bash("git diff --name-only HEAD~1 HEAD 2>/dev/null || echo ''")}

Steps:
1. For each file path, call getFileSizeAtRevision with "HEAD~1" then "HEAD".
2. delta = currentSize - previousSize.
3. change: "grew" if delta > 0, "shrank" if delta < 0, "unchanged" if 0.
4. Build files array with path, previousSize, currentSize, delta, change.
5. totalFiles = files.length.
6. largestGrowth = path with highest positive delta (omit if none grew).
7. largestShrink = path with most negative delta (omit if none shrank).`,
  output: s.object({
    files: s.array(s.object({
      path: s.string,
      previousSize: s.int,
      currentSize: s.int,
      delta: s.int,
      change: s.enum("grew", "shrank", "unchanged"),
    })),
    totalFiles: s.int,
    largestGrowth: s.optional(s.string),
    largestShrink: s.optional(s.string),
  }),
  tools: [getFileSizeAtRevision],
  addons: [repair()],
});

export default gitFileSizeTracker;
```
