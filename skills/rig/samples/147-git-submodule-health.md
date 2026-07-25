# 147 - Git Submodule Health

```rig
import { agent, p, s, defineTool } from "rig";

const parseSubmoduleStatus = defineTool("parseSubmoduleStatus", {
  description: "Parse a git submodule status line into structured fields.",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const trimmed = line.trimStart();
    if (!trimmed) return null;
    const statusChar = line[0];
    const rest = trimmed.replace(/^[\+\- U]/, "").trim();
    const parts = rest.split(/\s+/);
    const sha = parts[0] ?? "";
    const path = parts[1] ?? "";
    let status: "clean" | "modified" | "uninitialized" | "missing" = "clean";
    if (statusChar === "+") status = "modified";
    else if (statusChar === "-") status = "uninitialized";
    else if (statusChar === "U") status = "missing";
    return { path, sha, status };
  },
});

// Agent role: Inventory git submodules and report their health status.
const gitSubmoduleHealth = agent({
  model: "small",
  instructions: p`Check the health of all git submodules in this repository.

Submodule status:
${p.bash("git submodule status 2>/dev/null || echo '(no submodules)'")}

Submodule config:
${p.readOptional(".gitmodules", "(no .gitmodules file)")}

For each status line, use parseSubmoduleStatus to extract path, sha, and status.
Return submodules array, allClean flag, and totalCount.`,
  tools: [parseSubmoduleStatus],
  output: s.object({
    submodules: s.array(
      s.object({
        path: s.string,
        sha: s.string,
        status: s.enum("clean", "modified", "uninitialized", "missing"),
      }),
    ),
    allClean: s.boolean,
    totalCount: s.int,
  }),
});

export default gitSubmoduleHealth;
```
