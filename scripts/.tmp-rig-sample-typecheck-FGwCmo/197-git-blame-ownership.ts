import { agent, p, s, defineTool, steering } from "rig";

const parseBlameOutput = defineTool("parseBlameOutput", {
  description: "Parse git blame --line-porcelain output to compute per-author line counts",
  parameters: s.object({ blameText: s.string }),
  handler({ blameText }) {
    const authorCounts: Record<string, number> = {};
    let totalLines = 0;
    for (const match of blameText.matchAll(/^author (.+)$/gm)) {
      const author = match[1].trim();
      authorCounts[author] = (authorCounts[author] ?? 0) + 1;
      totalLines++;
    }
    return { authorCounts, totalLines };
  },
});

// Agent role: analyze git blame for a file to report per-author line ownership.
const gitBlameOwnership = agent({
  model: "typecheck",
  input: s.object({ filePath: s.path }),
  instructions: p`Run git blame on the file: ${p.bash("git blame --line-porcelain HEAD -- . 2>/dev/null | head -500 || echo ''")}. Use parseBlameOutput on the porcelain output. Compute per-author percentage from line counts. Identify the top author.`,
  output: s.object({
    authors: s.record(s.object({
      lineCount: s.int,
      percentage: s.number,
      firstLine: s.optional(s.int),
      lastLine: s.optional(s.int),
    })),
    topAuthor: s.string,
    totalLines: s.int,
  }),
  tools: [parseBlameOutput],
  addons: steering({ message: "Ensure percentages sum to 100 and totalLines matches the sum of all line counts." }),
});

export default gitBlameOwnership;
