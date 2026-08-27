# 471 - Git Hook Scanner

```rig
import { agent, defineTool, p, repair, s } from "rig";

const analyzeHookFile = defineTool("analyzeHookFile", {
  description: "Read a git hook file and determine its shebang line and executability.",
  parameters: s.object({ hookPath: s.path }),
  handler: async ({ hookPath }) => {
    const { readFile, stat } = await import("node:fs/promises");
    const info = await stat(hookPath);
    const isExecutable = (info.mode & 0o111) !== 0;
    let shebang: string | undefined;
    try {
      const content = await readFile(hookPath, "utf-8");
      const firstLine = content.split("\n")[0] ?? "";
      if (firstLine.startsWith("#!")) shebang = firstLine;
    } catch {
      // unreadable
    }
    return { isExecutable, shebang };
  },
});

// Agent role: scan .git/hooks/ and classify each hook file by type.
const gitHookScanner = agent({
  model: "small",
  instructions: p`List all files in ${p.bash("ls -la .git/hooks/ 2>/dev/null || echo ''")}. For each hook file (skip .sample files and README), call analyzeHookFile with its full path (.git/hooks/<name>). Classify hookType as one of: pre-commit, commit-msg, post-commit, pre-push, pre-receive, other. Return hooks as a record keyed by hook name, plus activeCount (executable hooks) and totalHooks.`,
  output: s.object({
    hooks: s.record(s.object({
      hookType: s.enum("pre-commit", "commit-msg", "post-commit", "pre-push", "pre-receive", "other"),
      shebang: s.optional(s.string),
      isExecutable: s.boolean,
    })),
    activeCount: s.int,
    totalHooks: s.int,
  }),
  tools: [analyzeHookFile],
  maxTurns: 6,
  addons: repair(),
});

export default gitHookScanner;
```
