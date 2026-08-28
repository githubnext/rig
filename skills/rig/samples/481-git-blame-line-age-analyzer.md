# 481 - Git Blame Line Age Analyzer

```rig
import { agent, defineTool, p, repair, s } from "rig";

const parseBlameBlock = defineTool("parseBlameBlock", {
  description: "Parse git blame --line-porcelain output for a file and return per-line age stats.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { execSync } = await import("node:child_process");
    let output = "";
    try {
      output = execSync(`git blame --line-porcelain -- ${filePath}`, { encoding: "utf-8" });
    } catch {
      return { avgAgeDays: 0, staleLines: 0, recentLines: 0, totalLines: 0 };
    }
    const now = Date.now();
    const timestamps: number[] = [];
    for (const line of output.split("\n")) {
      if (line.startsWith("author-time ")) {
        timestamps.push(parseInt(line.slice("author-time ".length), 10) * 1000);
      }
    }
    if (timestamps.length === 0) return { avgAgeDays: 0, staleLines: 0, recentLines: 0, totalLines: 0 };
    const ages = timestamps.map((t: number) => (now - t) / 86400000);
    const avgAgeDays = ages.reduce((a: number, b: number) => a + b, 0) / ages.length;
    const recentLines = ages.filter((d: number) => d < 30).length;
    const staleLines = ages.filter((d: number) => d >= 180).length;
    return { avgAgeDays, staleLines, recentLines, totalLines: ages.length };
  },
});

// Agent role: analyze line age across TypeScript source files using git blame.
const gitBlameLineAge = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.glob("src/**/*.ts")}. For each file path, call parseBlameBlock. Return files as a record keyed by path with avgAgeDays, staleLines, recentLines, totalLines. Also include oldestFile (path with highest avgAgeDays, omit if none) and newestFile (path with lowest avgAgeDays, omit if none).`,
  output: s.object({
    files: s.record(s.object({
      avgAgeDays: s.number,
      staleLines: s.int,
      recentLines: s.int,
      totalLines: s.int,
    })),
    oldestFile: s.optional(s.string),
    newestFile: s.optional(s.string),
  }),
  tools: [parseBlameBlock],
  maxTurns: 8,
  addons: [repair()],
});

export default gitBlameLineAge;
```
