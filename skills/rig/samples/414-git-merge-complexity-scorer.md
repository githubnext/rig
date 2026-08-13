# 414 - Git Merge Complexity Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: score git merge commits by complexity based on files changed.
const gitMergeComplexityScorer = agent({
  model: "small",
  instructions: p`Score the complexity of recent merge commits in this repository.

Recent merge commits:
${p.bash("git log --merges --oneline -20 2>/dev/null || echo '(no merges found)'")}

For each merge commit hash, call scoreMergeComplexity. Then produce the declared output.`,
  tools: [
    defineTool("scoreMergeComplexity", {
      description: "Score a merge commit complexity by running git show --stat",
      parameters: s.object({ hash: s.string, message: s.string }),
      handler({ hash, message }: { hash: string; message: string }) {
        const { execSync } = require("node:child_process");
        try {
          const stat = execSync(`git show --stat ${hash} 2>/dev/null`, { encoding: "utf-8" });
          const match = stat.match(/(\d+) files? changed/);
          const filesChanged = match ? parseInt(match[1], 10) : 0;
          const complexity: "simple" | "moderate" | "complex" =
            filesChanged <= 3 ? "simple" : filesChanged <= 10 ? "moderate" : "complex";
          return { hash, message, filesChanged, complexity };
        } catch {
          return { hash, message, filesChanged: 0, complexity: "simple" as const };
        }
      },
    }),
  ],
  output: s.object({
    merges: s.array(s.object({
      hash: s.string,
      message: s.string,
      filesChanged: s.int,
      complexity: s.enum("simple", "moderate", "complex"),
    })),
    totalMerges: s.int,
    complexMergeCount: s.int,
    mostComplexMerge: s.optional(s.string),
  }),
  addons: [repair()],
});

export default gitMergeComplexityScorer;

```
