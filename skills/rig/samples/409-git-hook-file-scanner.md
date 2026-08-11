# 409 - Git Hook File Scanner

```rig
import { agent, p, s, repair, defineTool } from "rig";

const analyzeHookFile = defineTool("analyzeHookFile", {
  description: "Analyze a .git/hooks file for shebang, executability, and hook type.",
  parameters: s.object({ hookName: s.string }),
  handler: async ({ hookName }: { hookName: string }) => {
    const { readFile, stat } = await import("node:fs/promises");
    const filePath = `.git/hooks/${hookName}`;
    const knownHooks = ["pre-commit", "commit-msg", "post-commit", "pre-push", "pre-receive"] as const;
    type HookType = "pre-commit" | "commit-msg" | "post-commit" | "pre-push" | "pre-receive" | "other";
    const hookType: HookType = (knownHooks as readonly string[]).includes(hookName)
      ? hookName as HookType
      : "other";
    let hasShebang = false;
    let isExecutable = false;
    let lineCount = 0;
    try {
      const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      hasShebang = content.startsWith("#!");
      isExecutable = (info.mode & 0o111) !== 0;
      lineCount = content.split("\n").length;
    } catch {
      // file unreadable
    }
    return { hookType, hasShebang, isExecutable, lineCount };
  },
});

// Agent role: Scan .git/hooks directory and analyze each hook file.
const gitHookFileScanner = agent({
  model: "small",
  instructions: p`Hook files found in .git/hooks/:
${p.bash("ls .git/hooks/ 2>/dev/null || echo ''")}

For each hook filename listed above (skip empty output), call analyzeHookFile with the hook name. Return hooks as a record keyed by hook name, along with activeCount (hooks that are executable) and totalHooks.`,
  tools: [analyzeHookFile],
  output: s.object({
    hooks: s.record(
      s.object({
        hookType: s.enum("pre-commit", "commit-msg", "post-commit", "pre-push", "pre-receive", "other"),
        hasShebang: s.boolean,
        isExecutable: s.boolean,
        lineCount: s.int,
      })
    ),
    activeCount: s.int,
    totalHooks: s.int,
  }),
  addons: [repair()],
});

export default gitHookFileScanner;
```
