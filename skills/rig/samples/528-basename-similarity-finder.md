# 528 - Basename Similarity Finder

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: compute a simple similarity score between two basenames using shared-character overlap.
const basenameSimilarity = defineTool("basename_similarity", {
  description: "Compute a similarity score between two file basenames.",
  parameters: s.object({
    a: s.string,
    b: s.string,
  }),
  handler: async ({ a, b }: { a: string; b: string }) => {
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    let shared = 0;
    for (const ch of setA) {
      if (setB.has(ch)) shared += 1;
    }
    const union = new Set([...setA, ...setB]).size || 1;
    return { score: shared / union };
  },
});

// Agent role: find near-duplicate basenames among discovered source files using the similarity tool.
const duplicateFinder = agent({
  model: "small",
  tools: [basenameSimilarity],
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. Extract each file's basename, then use basename_similarity to compare every distinct pair of basenames. Return the pairs with their full original paths and similarity score, sorted by score descending.`,
  output: s.array(
    s.object({
      pathA: s.path,
      pathB: s.path,
      score: s.number,
    }),
  ),
});

export default duplicateFinder;
```
