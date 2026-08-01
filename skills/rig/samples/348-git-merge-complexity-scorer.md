# 348 - Git Merge Complexity Scorer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const scoreMergeComplexity = defineTool("scoreMergeComplexity", {
  description: "Classify a git merge commit as simple, moderate, or complex based on files changed",
  parameters: s.object({ hash: s.string, message: s.string, filesChanged: s.int }),
  handler({ hash, message, filesChanged }) {
    const complexity: "simple" | "moderate" | "complex" =
      filesChanged <= 3 ? "simple" as const
      : filesChanged <= 10 ? "moderate" as const
      : "complex" as const;
    return { hash, message, filesChanged, complexity };
  },
});

// Agent role: score git merge commits by complexity based on the number of files changed.
const gitMergeComplexityScorer = agent({
  model: "small",
  instructions: p`Recent merge commits: ${p.bash("git log --merges --oneline -20 2>/dev/null || echo ''")}
Merge diff stats: ${p.bash("git log --merges --oneline -20 --format='%H %s' 2>/dev/null | head -20 | while read hash msg; do count=$(git show --stat $hash 2>/dev/null | grep -E 'files? changed' | grep -oE '[0-9]+ files? changed' | grep -oE '^[0-9]+' || echo 0); echo \"$hash|$count|$msg\"; done")}

For each merge commit, call scoreMergeComplexity with its hash, message, and filesChanged count. Count totalMerges and complexMergeCount. Set mostComplexMerge to the hash with the highest filesChanged (omit if no merges).`,
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
  tools: [scoreMergeComplexity],
  addons: [repair()],
  maxTurns: 5,
});

export default gitMergeComplexityScorer;
```
