import { agent, p, s, defineTool } from "rig";

const parseSubmoduleStatus = defineTool("parseSubmoduleStatus", {
  description: "Parse a git submodule status line into structured fields.",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const statusChar = line[0] ?? " ";
    const rest = line.slice(1).trim();
    const parts = rest.split(/\s+/);
    const sha = parts[0] ?? "";
    const path = parts[1] ?? "";
    let status: "clean" | "modified" | "uninitialized" | "conflict" = "clean";
    if (statusChar === "+") status = "modified";
    else if (statusChar === "-") status = "uninitialized";
    else if (statusChar === "U") status = "conflict";
    const describeMatch = rest.match(/\(([^)]+)\)$/);
    return { path, sha, status, describe: describeMatch?.[1] };
  },
});

// Agent role: Inventory git submodules and report their health status.
const gitSubmoduleHealth = agent({
  model: "typecheck",
  instructions: p`Check the health of all git submodules.

Submodule status:
${p.bash("git submodule status 2>/dev/null || echo '(no submodules)'")}

Submodule config:
${p.readOptional(".gitmodules", "(no .gitmodules file)")}

For each non-empty status line, call parseSubmoduleStatus to extract path, sha, status, and optional describe.
Return submodules array, allClean (true if every status is "clean"), and totalCount.`,
  tools: [parseSubmoduleStatus],
  output: s.object({
    submodules: s.array(
      s.object({
        path: s.path,
        sha: s.string,
        status: s.enum("clean", "modified", "uninitialized", "conflict"),
        describe: s.optional(s.string),
      })
    ),
    allClean: s.boolean,
    totalCount: s.int,
  }),
});

export default gitSubmoduleHealth;
