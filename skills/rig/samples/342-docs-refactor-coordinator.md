# 342 - Docs Refactor Coordinator

```rig
import { agent, p, s } from "rig";

// Agent role: extract every API name, function signature, and method reference from the documentation.
const apiExtractor = agent({
  name: "apiExtractor",
  model: "small",
  instructions: p`Read: ${p.read("README.md")}. Extract all API names, function signatures, and method references. Return a flat list of unique identifiers.`,
  output: s.array(s.string),
});

// Agent role: rewrite documentation prose to be clearer and more concise.
const proseCleanup = agent({
  name: "proseCleanup",
  model: "small",
  instructions: p`Read: ${p.read("README.md")}. Rewrite the prose sections for clarity and conciseness without altering technical accuracy. Return the improved markdown text.`,
  output: s.string,
});

// Agent role: coordinate API extraction and prose cleanup, then write a refactored docs file.
const docsRefactorCoordinator = agent({
  model: "small",
  instructions: p`Delegate to apiExtractor and proseCleanup subagents. Combine their outputs: extractedApis from apiExtractor and improved prose from proseCleanup. Write the refactored content to ${p.write("docs/refactored.md", "REFACTORED_CONTENT")}. Count the number of substantive prose changes made.`,
  output: s.object({
    extractedApis: s.array(s.string),
    changesApplied: s.int,
    outputPath: s.path,
  }),
  agents: { apiExtractor, proseCleanup },
});

export default docsRefactorCoordinator;
```
