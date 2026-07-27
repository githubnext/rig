# 236 - Vitest Coverage Parser

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const parseCoverageSummary = defineTool("parseCoverageSummary", {
  description: "Parse a vitest coverage-summary.json file to extract per-file coverage metrics.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }) => {
    const raw = await readFile(filePath, "utf8");
    const json = JSON.parse(raw) as Record<string, { lines: { pct: number }; branches: { pct: number }; functions: { pct: number } }>;
    const files: Record<string, { lines: number; branches: number; functions: number; status: string }> = {};
    let totalLines = 0, totalBranches = 0, totalFunctions = 0, count = 0;
    for (const [file, data] of Object.entries(json)) {
      if (file === "total") continue;
      const lines = data.lines?.pct ?? 0;
      const branches = data.branches?.pct ?? 0;
      const functions = data.functions?.pct ?? 0;
      const avg = (lines + branches + functions) / 3;
      const status = avg >= 80 ? "covered" : avg >= 40 ? "partial" : "uncovered";
      files[file] = { lines, branches, functions, status };
      totalLines += lines; totalBranches += branches; totalFunctions += functions; count++;
    }
    const n = count || 1;
    return {
      files,
      overall: { lines: totalLines / n, branches: totalBranches / n, functions: totalFunctions / n },
      totalFiles: count,
    };
  },
});

// Agent role: parse vitest coverage output and return a per-file coverage report.
const vitestCoverageParser = agent({
  model: "small",
  instructions: p`Parse the vitest coverage report for this project.

Coverage summary file: ${p.readOptional("coverage/coverage-summary.json")}

If the coverage summary file is available, call parseCoverageSummary with path "coverage/coverage-summary.json".
Otherwise, report all counts as 0 and status as "uncovered".

Count files with lines coverage >= 80% as "well covered".
Return the per-file metrics, overall averages, total file count, and well-covered count.`,
  output: s.object({
    files: s.record(s.object({
      lines: s.number,
      branches: s.number,
      functions: s.number,
      status: s.enum("covered", "partial", "uncovered"),
    })),
    overall: s.object({
      lines: s.number,
      branches: s.number,
      functions: s.number,
    }),
    totalFiles: s.int,
    wellCoveredCount: s.int,
  }),
  tools: [parseCoverageSummary],
});

export default vitestCoverageParser;
```
