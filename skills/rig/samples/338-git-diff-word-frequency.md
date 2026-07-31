# 338 - Git Diff Word Frequency

```rig
import { agent, p, s, defineTool } from "rig";

const countWordChanges = defineTool("countWordChanges", {
  description: "Count added and deleted words from a git word-diff porcelain output",
  parameters: s.object({ diffOutput: s.string }),
  handler: ({ diffOutput }: { diffOutput: string }) => {
    const lines = diffOutput.split("\n");
    const addedWords: Record<string, number> = {};
    const deletedWords: Record<string, number> = {};
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        line.slice(1).split(/\s+/).filter(Boolean).forEach((w: string) => {
          addedWords[w] = (addedWords[w] ?? 0) + 1;
        });
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        line.slice(1).split(/\s+/).filter(Boolean).forEach((w: string) => {
          deletedWords[w] = (deletedWords[w] ?? 0) + 1;
        });
      }
    }
    const sortByCount = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    return {
      topAddedWords: sortByCount(addedWords),
      topDeletedWords: sortByCount(deletedWords),
      totalAdditions: Object.values(addedWords).reduce((a, b) => a + b, 0),
      totalDeletions: Object.values(deletedWords).reduce((a, b) => a + b, 0),
    };
  },
});

// Agent role: analyze word-level changes in the last git diff and report top added/deleted words.
const gitDiffWordFrequency = agent({
  model: "small",
  instructions: p`Word diff output: ${p.bash("git diff --word-diff=porcelain HEAD~1 HEAD 2>/dev/null || git diff --word-diff=porcelain HEAD 2>/dev/null || echo 'no diff'")}
Call countWordChanges with the diff output and return the word frequency analysis.`,
  output: s.object({
    topAddedWords: s.array(s.string),
    topDeletedWords: s.array(s.string),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostFrequentAddition: s.optional(s.string),
  }),
  tools: [countWordChanges],
  maxTurns: 4,
});

export default gitDiffWordFrequency;
```
