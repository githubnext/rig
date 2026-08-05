# 373 - Git Hook Installer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkHooksDir = defineTool("checkHooksDir", {
  description: "Check whether .git/hooks directory exists and is writable.",
  parameters: s.object({}),
  async handler() {
    const { access, constants } = await import("node:fs/promises");
    try {
      await access(".git/hooks", constants.W_OK);
      return { exists: true, writable: true };
    } catch {
      return { exists: false, writable: false };
    }
  },
});

// Agent role: install git hooks into the .git/hooks directory from the provided hook specs.
const gitHookInstaller = agent({
  model: "small",
  input: s.object({
    hooks: s.array(
      s.object({
        name: s.string,
        script: s.string,
        description: s.string,
      })
    ),
  }),
  instructions: p`Install git hooks into .git/hooks from the provided input.

First call checkHooksDir to verify the hooks directory is accessible.
For each hook in input.hooks, write the script to .git/hooks/<name> using p.write.
Track which hooks were written successfully and which were skipped (if directory not found).
Return writtenHooks (names of installed hooks), skippedHooks (names not installed),
totalWritten (count of written), and allWritten (true if writtenHooks.length === input.hooks.length).`,
  tools: [checkHooksDir],
  output: s.object({
    writtenHooks: s.array(s.string),
    skippedHooks: s.array(s.string),
    totalWritten: s.int,
    allWritten: s.boolean,
  }),
  maxTurns: 6,
  addons: repair(),
});

export default gitHookInstaller;

```
