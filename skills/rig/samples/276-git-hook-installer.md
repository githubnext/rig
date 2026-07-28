# 276 - Git Hook Installer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkHooksDir = defineTool("checkHooksDir", {
  description: "Check if the .git/hooks directory exists.",
  parameters: s.object({}),
  async handler() {
    const { access } = await import("node:fs/promises");
    try {
      await access(".git/hooks");
      return { exists: true };
    } catch {
      return { exists: false };
    }
  },
});

// Agent role: install git hook scripts into .git/hooks for the current repository.
const gitHookInstaller = agent({
  model: "small",
  addons: repair(),
  input: s.object({
    hooks: s.array(
      s.object({
        name: s.string,
        script: s.string,
        description: s.string,
      })
    ),
  }),
  instructions: p`Install git hook scripts into the .git/hooks directory.

Existing hooks directory:
${p.bash("ls .git/hooks 2>/dev/null || echo 'no .git/hooks directory'")}

First call checkHooksDir to verify the directory exists.
For each hook in input.hooks:
- If .git/hooks exists, write the script to .git/hooks/<name> using a write operation, then run chmod +x via bash.
- If .git/hooks does not exist, add the hook name to skippedHooks.
Track writtenHooks as array of { name, path } for each successfully written hook.
Set totalWritten and allWritten accordingly.`,
  tools: [checkHooksDir],
  output: s.object({
    writtenHooks: s.array(s.object({ name: s.string, path: s.string })),
    skippedHooks: s.array(s.string),
    totalWritten: s.int,
    allWritten: s.boolean,
  }),
});

export default gitHookInstaller;
```
