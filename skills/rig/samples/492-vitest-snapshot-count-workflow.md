# 492 - Vitest Snapshot Count Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: scan for Vitest snapshot files and count lines.
const snapshotScanner = agent({
  model: "small",
  instructions: p`Find snapshot files with ${p.bash("find . -path '*/__snapshots__/*.snap' -not -path '*/node_modules/*' 2>/dev/null | head -20 || true")} and count lines in each with ${p.bash("find . -path '*/__snapshots__/*.snap' -not -path '*/node_modules/*' 2>/dev/null | xargs wc -l 2>/dev/null || echo '0 total'")}. Return the file list and total count.`,
  output: s.object({
    files: s.array(s.object({ path: s.path, lineCount: s.int })),
    totalFiles: s.int,
  }),
});

// Agent role: count snapshot export entries across snapshot files.
const snapshotParser = agent({
  model: "small",
  instructions: p`Find snapshot files containing exports using ${p.bash("grep -rl 'exports\\[' . --include='*.snap' 2>/dev/null | head -20 || true")}. Count total export entries with ${p.bash("grep -r 'exports\\[' . --include='*.snap' 2>/dev/null | wc -l || echo 0")}. Return file list and count.`,
  output: s.object({
    snapshotFiles: s.array(s.path),
    exportCount: s.int,
  }),
});

// Workflow role: run snapshot scanner and parser in parallel and combine results.
const vitestSnapshotWorkflow = workflow({
  meta: { name: "vitest-snapshot-count-workflow", description: "Count Vitest snapshots in parallel" },
  body: async ({ call }) => {
    const [scanResult, parseResult] = await Promise.all([
      call(snapshotScanner, ""),
      call(snapshotParser, ""),
    ]);
    return {
      totalSnapshotFiles: scanResult?.totalFiles ?? 0,
      totalLines: (scanResult?.files ?? []).reduce((sum: number, f: { lineCount: number }) => sum + f.lineCount, 0),
      snapshotFiles: parseResult?.snapshotFiles ?? [],
    };
  },
});

export default vitestSnapshotWorkflow;
```
