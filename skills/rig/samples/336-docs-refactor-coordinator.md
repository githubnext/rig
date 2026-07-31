# 336 - Docs Refactor Coordinator

```rig
import { agent, p, s } from "rig";

// Agent role: extract API names from README.
const apiExtractor = agent({
  name: "apiExtractor",
  model: "small",
  instructions: p`Read the README: ${p.read("README.md")}
Extract all API function and class names mentioned. Return a list of API names.`,
  output: s.object({
    apiNames: s.array(s.string),
  }),
});

// Agent role: rewrite prose sections of README for clarity.
const proseCleanup = agent({
  name: "proseCleanup",
  model: "small",
  instructions: p`Read the README: ${p.read("README.md")}
Rewrite the prose sections for clarity, removing jargon and improving readability. Return cleaned prose.`,
  output: s.object({
    cleanedProse: s.string,
    changesApplied: s.int,
  }),
});

// Agent role: coordinate API extraction and prose cleanup, then emit a refactored README.
const docsRefactorCoordinator = agent({
  model: "small",
  instructions: p`Coordinate the documentation refactor:
1. Ask apiExtractor to extract all API names from README.md
2. Ask proseCleanup to rewrite the prose
3. Combine results into a refactoredContent string
${p.writeOutput("refactoredContent", "refactored.md")}
Return extractedApis, changesApplied, and outputPath.`,
  output: s.object({
    extractedApis: s.array(s.string),
    changesApplied: s.int,
    outputPath: s.path,
    refactoredContent: s.string,
  }),
  agents: { apiExtractor, proseCleanup },
  maxTurns: 6,
});

export default docsRefactorCoordinator;
```
