# 344 - Docs Refactor Coordinator V2

```rig
import { agent, p, s } from "rig";

// Agent role: Extract API names from README.md.
const apiExtractor = agent({
  name: "apiExtractor",
  model: "small",
  instructions: p`Extract all public API function and class names from this documentation.

${p.read("README.md")}

Return the list of API names found.`,
  output: s.object({ apis: s.array(s.string) }),
});

// Agent role: Rewrite documentation prose to be cleaner and more concise.
const proseCleanup = agent({
  name: "proseCleanup",
  model: "small",
  input: s.object({ originalText: s.string }),
  instructions: p`Rewrite the following documentation prose to be cleaner, more concise, and easier to read.

Original text: {{originalText}}

Return the rewritten text.`,
  output: s.object({ rewritten: s.string }),
});

// Agent role: Coordinate docs refactoring by delegating to apiExtractor and proseCleanup subagents, then writing the result.
const docsRefactorCoordinator = agent({
  model: "small",
  instructions: p`You are a docs refactor coordinator.

Read README.md content:
${p.read("README.md")}

Delegate to the apiExtractor subagent to extract API names.
Delegate to the proseCleanup subagent to rewrite the prose.
Then write the combined refactored documentation to refactored.md using p.write.

${p.writeOutput("outputPath", "refactored.md")}

Return the list of extracted APIs, count of changes applied, and the output path.`,
  agents: { apiExtractor, proseCleanup },
  output: s.object({
    extractedApis: s.array(s.string),
    changesApplied: s.int,
    outputPath: s.string,
  }),
});

export default docsRefactorCoordinator;
```
