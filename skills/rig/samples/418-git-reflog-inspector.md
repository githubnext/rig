# 418 - Git Reflog Inspector

```rig
import { agent, defineTool, p, s } from "rig";
import { steering } from "rig";

const classifyReflogEntry = defineTool("classifyReflogEntry", {
  description: "Parse a git reflog line and classify its action type.",
  parameters: s.object({ reflogLine: s.string }),
  handler({ reflogLine }: { reflogLine: string }) {
    const parts = reflogLine.trim().split(/\s+/);
    const hash = parts[0] ?? "";
    const rest = parts.slice(1).join(" ");
    const lower = rest.toLowerCase();
    const action =
      lower.includes("merge") ? ("merge" as const)
        : lower.includes("rebase") ? ("rebase" as const)
          : lower.includes("reset") ? ("reset" as const)
            : lower.includes("checkout") ? ("checkout" as const)
              : lower.includes("commit") ? ("commit" as const)
                : ("other" as const);
    const message = rest.replace(/^HEAD@\{\d+\}:\s*/, "").trim();
    return { hash, action, message };
  },
});

// Agent role: inspect git reflog entries and classify each by action type.
const gitReflogInspector = agent({
  model: "small",
  instructions: p`Inspect recent git reflog entries.

Reflog:
${p.bash("git reflog --oneline -50 2>/dev/null || echo '(no git history)'")}

For each reflog line, call classifyReflogEntry. Build entries array with hash, action, message. Compute actionCounts as a record from action → count. totalEntries = total lines processed.`,
  output: s.object({
    entries: s.array(s.object({
      hash: s.string,
      action: s.enum("commit", "merge", "rebase", "reset", "checkout", "other"),
      message: s.string,
    })),
    actionCounts: s.record(s.number),
    totalEntries: s.number,
  }),
  tools: [classifyReflogEntry],
  addons: [steering()],
});

export default gitReflogInspector;
```
