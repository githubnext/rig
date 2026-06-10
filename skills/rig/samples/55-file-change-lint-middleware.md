# 55 - File Change Lint Middleware

```rig
import { agent, s, type AgentAddon } from "rig";
import { $ } from "zx";

const fingerprint = async () => {
  const { exitCode, stdout } = await $`git status --porcelain`.nothrow();
  return exitCode === 0 ? stdout.trim() : "";
};
const lintOnFileChange = (runLint: () => Promise<unknown>): AgentAddon => async (_context, next) => {
  const before = await fingerprint();
  await next();
  const after = await fingerprint();
  if (before !== after) await runLint();
};

// Agent role: update files and run linting after file changes.
const fileChangeMiddleware = agent({
  model: "mini",
  instructions: "Update files when needed, then summarize the change.",
  output: s.object({ changed: s.boolean, summary: s.string }),
  addons: lintOnFileChange(() => $`npm run typecheck`),
});

export default fileChangeMiddleware;
```
