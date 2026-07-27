# 224 - Git Hook Inventory V2

```rig
import { agent, defineTool, p, s } from "rig";

const classifyHook = defineTool("classifyHook", {
  description: "Classify a git hook by inspecting its content",
  parameters: s.object({ name: s.string, content: s.string }),
  handler({ content }) {
    if (!content || content.trim() === "missing") {
      return { status: "missing" as const, isAsync: false, summary: "Hook file not present" };
    }
    const isSample = content.includes("sample") || content.trim() === "#!/bin/sh" || content.trim() === "#!/bin/bash";
    const isAsync = content.includes(" &") || content.includes("async ");
    const status = isSample ? "stub" : "active";
    const summary = isSample ? "Sample/placeholder hook — not active" : `Active hook (${content.split("\n").length} lines)`;
    return { status, isAsync, summary } as { status: "active" | "stub" | "missing"; isAsync: boolean; summary: string };
  },
});

// Agent role: inventory git hooks and classify each as active, stub, or missing.
const gitHookInventory = agent({
  model: "small",
  instructions: p`List and inspect git hooks: ${p.bash("ls .git/hooks/ 2>/dev/null || echo 'no hooks directory'")}. ${p.bash("for f in pre-commit commit-msg pre-push post-commit prepare-commit-msg pre-rebase; do echo \"=== $f ===\"; cat \".git/hooks/$f\" 2>/dev/null || echo 'missing'; done")}. Use classifyHook for each hook name with its content. Return a record keyed by hook name.`,
  tools: [classifyHook],
  output: s.record(s.object({
    summary: s.string,
    status: s.enum("active", "stub", "missing"),
    isAsync: s.boolean,
  })),
});

export default gitHookInventory;
```
