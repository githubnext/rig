# 06 - List Source Files

```rig
import { agent, p, s } from "rig";

// Agent role: list TypeScript source files and return a categorized summary.
const listSourceFiles = agent({
  model: "small",
  instructions: p`List and categorize the TypeScript files in this workspace.

Files: ${p.glob("src/**/*.ts")}`,
  output: s.object({
    files: s.array(s.path),
    summary: s.string,
  }),
});

export default listSourceFiles;
```
