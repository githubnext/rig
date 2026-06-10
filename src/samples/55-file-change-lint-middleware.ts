import { agent, s } from "rig";
import type { AgentAddon } from "rig";
import { $ } from "zx";

async function workspaceFingerprint(): Promise<string> {
  const { exitCode, stdout } = await $`git status --porcelain`.nothrow();
  return exitCode === 0 ? stdout.trim() : "";
}

function lintOnFileChange(runLint: () => Promise<unknown>): AgentAddon {
  return async (_context, next) => {
    const before = await workspaceFingerprint();
    await next();
    const after = await workspaceFingerprint();
    if (before !== after) {
      await runLint();
    }
  };
}

// Agent role: apply workspace changes and trigger linting when files changed.
const fileChangeMiddleware = agent({
  model: "mini",
  instructions: "Update files when needed, then summarize the change.",
  output: s.object({
    changed: s.boolean,
    summary: s.string,
  }),
  addons: lintOnFileChange(() => $`npm run typecheck`),
});

await fileChangeMiddleware("Inspect the workspace and apply a small fix if needed.");

export default fileChangeMiddleware;
