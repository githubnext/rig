# 234 - Git Hook Inventory V3

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile, access, constants } from "node:fs/promises";

const classifyHook = defineTool("classifyHook", {
  description: "Classify a git hook as active, stub, or missing based on its content.",
  parameters: { hookName: s.string },
  handler: async ({ hookName }) => {
    const hookPath = `.git/hooks/${hookName}`;
    try {
      await access(hookPath, constants.F_OK);
      const content = await readFile(hookPath, "utf8");
      const isSample = content.includes("sample") || hookPath.endsWith(".sample");
      const isAsync = content.includes("&") || content.includes("nohup");
      const summary = isSample
        ? `Sample/stub hook at ${hookPath}`
        : `Active hook: ${content.split("\n")[1]?.trim() ?? ""}`;
      return { status: isSample ? "stub" : "active", isAsync, summary };
    } catch {
      return { status: "missing", isAsync: false, summary: `No hook at ${hookPath}` };
    }
  },
});

// Agent role: inventory and classify all standard git hooks in this repository.
const gitHookInventory = agent({
  model: "small",
  instructions: p`Inspect all standard git hooks and classify each one.

Hook directory listing: ${p.bash("ls -la .git/hooks/ 2>/dev/null || echo 'No .git/hooks directory'")}

Standard hooks to check: pre-commit, pre-push, commit-msg, post-commit, post-merge,
pre-rebase, post-checkout, prepare-commit-msg, pre-receive, post-receive.

For each hook name, call the classifyHook tool to determine its status.
Return a record keyed by hook name with status, isAsync, and summary.`,
  output: s.record(s.object({
    status: s.enum("active", "stub", "missing"),
    isAsync: s.boolean,
    summary: s.string,
  })),
  tools: [classifyHook],
});

export default gitHookInventory;
```
