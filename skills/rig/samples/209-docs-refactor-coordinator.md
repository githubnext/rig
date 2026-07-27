# 209 - Docs Refactor Coordinator

```rig
import { agent, p, s } from "rig";

// Agent role: extract API names mentioned in the documentation.
const apiExtractor = agent({
  name: "apiExtractor",
  model: "nano",
  instructions: p`Read the documentation: ${p.read("README.md")}. Extract every API name, function signature, and method reference mentioned in the document. Return a flat list of unique API identifiers.`,
  output: s.array(s.string),
});

// Agent role: rewrite documentation prose for clarity and conciseness.
const proseCleanup = agent({
  name: "proseCleanup",
  model: "nano",
  instructions: p`Read the documentation: ${p.read("README.md")}. Rewrite the prose to be clearer, more concise, and better structured. Return only the improved text.`,
  output: s.string,
});

// Agent role: coordinate docs refactoring by extracting APIs and cleaning prose, then writing the result.
const docsRefactorCoordinator = agent({
  model: "small",
  instructions: p`Delegate API extraction and prose cleanup to the named subagents. Merge their results: the apiExtractor returns the list of API names, and proseCleanup returns rewritten prose. Combine into a final output and write the refactored content to ${p.write("docs/refactored.md", "REFACTORED_CONTENT")}. Count the changes made to the prose.`,
  output: s.object({
    extractedApis: s.array(s.string),
    changesApplied: s.int,
    outputPath: s.path,
  }),
  agents: { apiExtractor, proseCleanup },
});

export default docsRefactorCoordinator;
```
