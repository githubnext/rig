# 320 - Git Blame Ownership

```rig
import { agent, p, s, defineTool, steering } from "rig";

// Agent role: analyze git blame output to compute per-author line ownership statistics for a given file.
const gitBlameOwnership = agent({
  model: "small",
  input: s.object({ filePath: s.string }),
  instructions: p`Analyze git blame for the file at input.filePath.
Run: ${p.bash("git blame --line-porcelain HEAD -- . 2>/dev/null | head -5 || echo 'no git'")}
Use the parseBlameOutput tool with the blame output for the requested file path.
Return per-author statistics.`,
  output: s.object({
    authors: s.record(s.object({
      lineCount: s.int,
      percentage: s.number,
      firstLine: s.int,
      lastLine: s.int,
    })),
    topAuthor: s.string,
    totalLines: s.int,
  }),
  tools: [
    defineTool("parseBlameOutput", {
      description: "Parse git blame --line-porcelain output and compute per-author line counts",
      parameters: s.object({ blameOutput: s.string }),
      handler({ blameOutput }) {
        const lines = blameOutput.split("\n");
        const authorCounts: Record<string, { count: number; first: number; last: number }> = {};
        let lineNum = 0;
        for (const line of lines) {
          if (line.startsWith("author ")) {
            lineNum++;
            const author = line.slice(7).trim();
            if (!authorCounts[author]) {
              authorCounts[author] = { count: 0, first: lineNum, last: lineNum };
            }
            authorCounts[author].count++;
            authorCounts[author].last = lineNum;
          }
        }
        return authorCounts;
      },
    }),
  ],
  addons: [steering()],
});

export default gitBlameOwnership;
```
