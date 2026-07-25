# 117 - Git Hook Inventory

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: inventory git hooks and classify each as active, stub, or missing.
const gitHookInventory = agent({
  model: "mini",
  instructions: p`Inventory the git hooks in this repository.

Available hooks in .git/hooks:
${p.bash("ls .git/hooks/ 2>/dev/null || echo 'no hooks directory'")}

Sample hooks content:
${p.bash("for f in .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/pre-push; do echo \"=== $f ===\"; cat \"$f\" 2>/dev/null || echo 'missing'; done")}

Use the classifyHook tool to classify each hook. Return a record keyed by hook name
with status, summary, and whether it runs asynchronously (uses & or async patterns).
Return only the declared output.`,
  tools: [
    defineTool("classifyHook", {
      description: "Classify a git hook by its content",
      parameters: s.object({ name: s.string, content: s.string }),
      handler({ content }) {
        if (!content || content === "missing") return { status: "missing", isAsync: false };
        const isSample = content.includes("sample") || content.trim() === "#!/bin/sh";
        const isAsync = content.includes(" &") || content.includes("async");
        return { status: isSample ? "stub" : "active", isAsync };
      },
    }),
  ],
  output: s.record(
    s.object({
      summary: s.string,
      status: s.enum("active", "stub", "missing"),
      isAsync: s.boolean,
    })
  ),
});

export default gitHookInventory;
```
