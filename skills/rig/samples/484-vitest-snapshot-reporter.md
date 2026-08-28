# 484 - Vitest Snapshot Reporter

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: find snapshot files using bash and report total file count.
const snapshotFileAgent = agent({
  model: "small",
  instructions: p`Run ${p.bash("find . -name '*.snap' 2>/dev/null || echo ''")} to list snapshot files. Return the list of file paths and total count.`,
  output: s.object({
    files: s.array(s.path),
    totalFiles: s.int,
  }),
});

// Agent role: count snapshot entries in a single snapshot file.
const snapshotCountAgent = agent({
  model: "small",
  input: s.object({ path: s.path }),
  instructions: p`Read the snapshot file at ${p.readInput("path")}. Count the number of snapshot entries (lines matching /^exports\[/). Return the file path and entry count.`,
  output: s.object({
    path: s.path,
    entryCount: s.int,
  }),
});

// Workflow role: discover snapshot files and count entries across the workspace.
export default workflow({
  meta: {
    name: "vitest-snapshot-reporter",
    description: "Discover vitest snapshot files and count snapshot entries across the workspace.",
  },
  body: async ({ call }) => {
    const fileResult = await call(snapshotFileAgent, "List all snapshot files.");
    if (!fileResult) return null;
    const counts = await Promise.all(
      fileResult.files.map((path: string) => call(snapshotCountAgent, { path }))
    );
    const validCounts = counts.filter((r): r is { path: string; entryCount: number } => r !== null);
    const totalSnapshots = validCounts.reduce((sum: number, r: { entryCount: number }) => sum + r.entryCount, 0);
    const largest = validCounts.reduce(
      (best: { path: string; entryCount: number } | null, r: { path: string; entryCount: number }) =>
        !best || r.entryCount > best.entryCount ? r : best,
      null
    );
    return {
      totalSnapshots,
      totalFiles: fileResult.totalFiles,
      largestSnapshotFile: largest?.path ?? undefined,
    };
  },
});
```
