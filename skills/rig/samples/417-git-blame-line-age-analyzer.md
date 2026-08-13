# 417 - Git Blame Line Age Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: analyze git blame line ages for TypeScript source files.
const gitBlameLineAgeAnalyzer = agent({
  model: "small",
  instructions: p`Analyze the age of lines in TypeScript source files using git blame.

TypeScript files (sample): ${p.bash("find src -name '*.ts' 2>/dev/null | head -10 || echo ''")}

For each file, call analyzeBlameAge to get line age statistics. Then produce the declared output.`,
  tools: [
    defineTool("analyzeBlameAge", {
      description: "Run git blame on a file and compute line age statistics",
      parameters: s.object({ filePath: s.path }),
      handler({ filePath }: { filePath: string }) {
        const { execSync } = require("node:child_process");
        try {
          const out = execSync(`git blame --line-porcelain "${filePath}" 2>/dev/null`, { encoding: "utf-8" });
          const now = Date.now() / 1000;
          const timestamps: number[] = [];
          for (const line of out.split("\n")) {
            if (line.startsWith("author-time ")) timestamps.push(parseInt(line.slice(12), 10));
          }
          if (timestamps.length === 0) return { filePath, avgAgeDays: 0, staleLines: 0, recentLines: 0, totalLines: 0 };
          const dayMs = 86400;
          let stale = 0, recent = 0;
          for (const ts of timestamps) {
            const days = (now - ts) / dayMs;
            if (days < 30) recent++;
            else if (days > 365) stale++;
          }
          const avgAgeDays = Math.round(timestamps.reduce((a, t) => a + (now - t) / dayMs, 0) / timestamps.length);
          return { filePath, avgAgeDays, staleLines: stale, recentLines: recent, totalLines: timestamps.length };
        } catch {
          return { filePath, avgAgeDays: 0, staleLines: 0, recentLines: 0, totalLines: 0 };
        }
      },
    }),
  ],
  output: s.object({
    files: s.record(s.object({
      avgAgeDays: s.int,
      staleLines: s.int,
      recentLines: s.int,
      totalLines: s.int,
    })),
    oldestFile: s.optional(s.string),
    newestFile: s.optional(s.string),
  }),
  addons: [repair()],
});

export default gitBlameLineAgeAnalyzer;

```
