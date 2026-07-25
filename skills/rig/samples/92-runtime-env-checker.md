# 92 - Runtime Env Checker

```rig
import { agent, p, s, defineTool } from "rig";

const checkThresholds = defineTool("checkThresholds", {
  description: "Validate environment values against minimum thresholds and return a list of issues",
  parameters: s.object({
    nodeVersion: s.string,
    heapMB: s.number,
  }),
  handler({ nodeVersion, heapMB }) {
    const issues: string[] = [];
    const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
    if (majorVersion < 18) issues.push(`Node.js ${nodeVersion} is below minimum v18`);
    if (heapMB < 256) issues.push(`Heap ${heapMB}MB is below 256MB minimum`);
    return { issues };
  },
});

// Agent role: inspect the runtime environment and report overall health.
const runtimeEnvChecker = agent({
  model: "small",
  instructions: p`Inspect the runtime environment using: ${p.bash("node --version")}, ${p.bash("uname -a")}, and ${p.bash("node -e \"console.log(Math.round(process.memoryUsage().heapTotal/1024/1024))\"")}. Use the checkThresholds tool to validate versions and memory. Determine overall health as ok, degraded, or critical based on issues found.`,
  output: s.object({
    health: s.enum("ok", "degraded", "critical"),
    nodeVersion: s.string,
    os: s.string,
    heapMB: s.number,
    issues: s.array(s.string),
  }),
  tools: [checkThresholds],
});

export default runtimeEnvChecker;
```
