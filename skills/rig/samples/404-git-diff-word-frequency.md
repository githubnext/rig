# 404 - Git Diff Word Frequency

```rig
import { agent, p, s, defineTool } from "rig";

const countWordChanges = defineTool("countWordChanges", {
  description: "Count added and deleted words from git --word-diff=porcelain output.",
  parameters: s.object({ diff: s.string }),
  handler: ({ diff }: { diff: string }) => {
    const addedWords: Record<string, number> = {};
    const deletedWords: Record<string, number> = {};
    for (const line of diff.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        const word = line.slice(1).trim();
        if (word) addedWords[word] = (addedWords[word] ?? 0) + 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        const word = line.slice(1).trim();
        if (word) deletedWords[word] = (deletedWords[word] ?? 0) + 1;
      }
    }
    const topAdded = Object.entries(addedWords).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    const topDeleted = Object.entries(deletedWords).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    const mostFrequent = topAdded[0];
    return {
      topAddedWords: topAdded,
      topDeletedWords: topDeleted,
      totalAdditions: Object.values(addedWords).reduce((a, b) => a + b, 0),
      totalDeletions: Object.values(deletedWords).reduce((a, b) => a + b, 0),
      mostFrequentAddition: mostFrequent ?? null,
    };
  },
});

// Agent role: Count added and deleted words in the current git diff and return the top words.
const gitDiffWordFrequency = agent({
  model: "small",
  instructions: p`Word-diff output:
${p.bash("git diff --word-diff=porcelain")}

Use the countWordChanges tool with the diff content above to count added and deleted words. Return the results.`,
  tools: [countWordChanges],
  output: s.object({
    topAddedWords: s.array(s.string),
    topDeletedWords: s.array(s.string),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostFrequentAddition: s.optional(s.string),
  }),
});

export default gitDiffWordFrequency;
```
