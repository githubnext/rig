# 448 - Workspace Symlink Inventory

```rig
import { agent, p, s, defineTool } from "rig";
import { lstat, readlink } from "node:fs/promises";
import { repair } from "rig";

const resolveSymlink = defineTool("resolveSymlink", {
  description: "Resolve a symlink and classify it as valid, broken, or relative",
  parameters: s.object({ linkPath: s.path }),
  handler: async ({ linkPath }: { linkPath: string }) => {
    const target = await readlink(linkPath);
    const isRelative = !target.startsWith("/");
    let status: "valid" | "broken" | "relative";
    try {
      await lstat(linkPath);
      status = isRelative ? "relative" as const : "valid" as const;
    } catch {
      status = "broken" as const;
    }
    return { target, status, isRelative };
  },
});

// Agent role: Inventory all symlinks in the workspace and classify their status.
const workspaceSymlinkInventory = agent({
  model: "small",
  instructions: p`Find all symlinks: ${p.bash("find . -type l 2>/dev/null")}.
For each symlink path, call resolveSymlink to get its target and status.
Return per-link details plus total link count and broken link count.`,
  output: s.object({
    links: s.record(s.object({
      target: s.string,
      status: s.enum("valid", "broken", "relative"),
      isRelative: s.boolean,
    })),
    totalLinks: s.int,
    brokenCount: s.int,
  }),
  tools: [resolveSymlink],
  addons: [repair()],
});

export default workspaceSymlinkInventory;
```
