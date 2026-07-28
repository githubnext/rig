# 60 - Parallel File Linter (Workflow)

```rig
import { agent, s, workflow } from "rig";

// Agent role: check one TypeScript file for code quality issues.
const lintFile = agent({
  name: "lintFile",
  model: "nano",
  input: s.object({ file: s.path }),
  output: s.object({ issues: s.array(s.string) }),
  instructions: "Check the file for linting issues.",
});

// Workflow role: discover and lint TypeScript source files in parallel.
const linter = workflow({
  meta: { name: "linter", description: "Lint TypeScript files in parallel", phases: ["Discover", "Lint"] },
  body: async ({ call, phase, pipeline }) => {
    phase("Discover");
    const raw = await call.text("List TypeScript source files to lint, one path per line.");
    const files = (raw ?? "").split("\n").map((f) => f.trim()).filter(Boolean);
    phase("Lint");
    return pipeline(files, (file) => call(lintFile, { file }, { label: file }));
  },
});

export default linter;
```
