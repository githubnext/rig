# 420 - Vitest Snapshot Reporter

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: list vitest snapshot files using bash find.
const snapshotFileAgent = agent({
  model: "small",
  instructions: p`List all vitest snapshot files in the repository.
${p.bash("find . -name '*.snap' -not -path '*/node_modules/*' 2>/dev/null | head -50 || echo '(none found)'")}
Return all found snapshot file paths and the total count.`,
  output: s.object({
    files: s.array(s.path),
    totalFiles: s.int,
  }),
});

// Agent role: count snapshot entries in snapshot files using glob.
const snapshotCountAgent = agent({
  model: "small",
  instructions: p`Count snapshot entries in vitest snapshot files.
Snapshot files: ${p.glob("**/__snapshots__/*.snap")}
Count how many snapshot entries each file contains (each entry starts with "exports[").
Return a record mapping file path to entry count, plus the total across all files.`,
  output: s.object({
    entryCounts: s.record(s.int),
    totalSnapshots: s.int,
  }),
});

// Workflow role: run both snapshot agents in parallel and combine results.
const vitestSnapshotReporter = workflow({
  meta: { name: "vitestSnapshotReporter", description: "Count vitest snapshots across the repo", phases: ["Collect", "Summarize"] },
  body: async ({ call, phase }) => {
    phase("Collect");
    const [fileResult, countResult] = await Promise.all([
      call(snapshotFileAgent, "list snapshot files"),
      call(snapshotCountAgent, "count entries"),
    ]);
    phase("Summarize");
    const totalFiles = fileResult?.totalFiles ?? 0;
    const totalSnapshots = countResult?.totalSnapshots ?? 0;
    const entryCounts = countResult?.entryCounts ?? {};
    const largestSnapshotFile = Object.keys(entryCounts).sort((a, b) => (entryCounts[b] ?? 0) - (entryCounts[a] ?? 0))[0] ?? null;
    return { totalSnapshots, totalFiles, largestSnapshotFile };
  },
});

export default vitestSnapshotReporter;

```
