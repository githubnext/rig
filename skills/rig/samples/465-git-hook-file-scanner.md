# 465 - Git Hook File Scanner

```rig
import { agent, defineTool, p, repair, s } from "rig";


const analyzeHookFile = defineTool("analyzeHookFile", {
  description: "Read a git hook file and detect its shebang, executability, and type.",
  parameters: s.object({ hookPath: s.path("Full path to the hook file") }),
  async handler({ hookPath }) {
    const { readFile, stat } = await import("node:fs/promises");
    try {
      const [content, info] = await Promise.all([readFile(hookPath, "utf8"), stat(hookPath)]);
      const shebang = content.split("\n")[0] ?? "";
      const executable = !!(info.mode & 0o111);
      const name = hookPath.split("/").pop() ?? hookPath;
      const knownTypes = ["pre-commit", "commit-msg", "post-commit", "pre-push", "pre-receive"];
      const hookType = knownTypes.includes(name) ? name : "other";
      const lineCount = content.split("\n").length;
      return JSON.stringify({ shebang, executable, hookType, lineCount });
    } catch {
      return JSON.stringify({ error: "could not read hook" });
    }
  },
});

// Agent role: scan .git/hooks for installed hook scripts and report their properties.
const gitHookFileScanner = agent({
  name: "gitHookFileScanner",
  model: "small",
  instructions: p`List all files in the .git/hooks directory.
${p.bash("ls -1 .git/hooks/ 2>/dev/null || echo 'no hooks directory'")}
For each non-sample file, use analyzeHookFile passing the full path (.git/hooks/<name>).
Return hooks as a record keyed by hook name, activeCount (executable hooks), and totalHooks.`,
  output: s.object({
    hooks: s.record(s.object({
      shebang: s.string,
      executable: s.boolean,
      hookType: s.enum("pre-commit", "commit-msg", "post-commit", "pre-push", "pre-receive", "other"),
      lineCount: s.int,
    })),
    activeCount: s.int,
    totalHooks: s.int,
  }),
  tools: [analyzeHookFile],
  addons: [repair()],
});

export default gitHookFileScanner;
```
