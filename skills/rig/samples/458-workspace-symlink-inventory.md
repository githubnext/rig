# 458 - Workspace Symlink Inventory

```rig
import { agent, p, s, defineTool } from "rig";
import { readlink, realpath } from "node:fs/promises";

const resolveSymlink = defineTool("resolveSymlink", {
  description: "Resolve a symlink path and check if it is broken",
  parameters: s.object({ symlinkPath: s.path }),
  handler: async ({ symlinkPath }: { symlinkPath: string }) => {
    const target = await readlink(symlinkPath).catch(() => "");
    if (!target) return { path: symlinkPath, target: "", broken: true };
    const broken = await realpath(symlinkPath).then(() => false).catch(() => true);
    return { path: symlinkPath, target, broken };
  },
});

// Agent role: Inventory all symlinks in the workspace and report whether each is broken.
const workspaceSymlinkInventory = agent({
  model: "small",
  instructions: p`Find all symlinks in the workspace: ${p.bash("find . -type l 2>/dev/null | head -50")}. Call resolveSymlink for each path. Return the inventory.`,
  output: s.object({
    symlinks: s.array(s.object({
      path: s.path,
      target: s.string,
      broken: s.boolean,
    })),
    totalSymlinks: s.int,
    brokenCount: s.int,
  }),
  tools: [resolveSymlink],
});

export default workspaceSymlinkInventory;

```
