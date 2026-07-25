# 98 - Async Tool Node Builtins

```rig
import { agent, defineTool, p, s } from "rig";

const getProcessInfo = defineTool("getProcessInfo", {
  description: "Get running-process details for a named process using node:child_process",
  parameters: s.object({ name: s.string("process name") }),
  async handler({ name }) {
    const { execSync } = await import("node:child_process");
    try {
      const out = execSync(
        `ps -eo pid,comm,rss,etime 2>/dev/null | grep "${name}" | head -5 || true`,
        { encoding: "utf8" }
      );
      return out.trim() || "not found";
    } catch {
      return "not found";
    }
  },
});

// Agent role: summarize running Node.js processes and their resource usage.
const processReport = agent({
  model: "small",
  instructions: p`Inspect running processes with ${p.bash("ps aux | grep -E 'node|npm' | head -20")}. Use getProcessInfo for any named process you need details on.`,
  output: s.object({
    processes: s.array(s.object({
      name: s.string,
      pid: s.string,
      status: s.enum("running", "idle", "unknown"),
    })),
    summary: s.string,
  }),
  tools: [getProcessInfo],
});

export default processReport;
```
