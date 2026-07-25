# 112 - Runtime Env Health

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: inspect the runtime environment and report health status.
const runtimeEnvHealth = agent({
  model: "mini",
  instructions: p`Inspect the runtime environment using the collected info:
Node.js version: ${p.bash("node --version")}
OS info: ${p.bash("uname -a")}
Memory: ${p.bash("free -m 2>/dev/null || vm_stat 2>/dev/null || echo 'unknown'")}

Use the checkThreshold tool to validate Node.js version (minimum v18) and available memory
(minimum 256 MB). Return only the declared output.`,
  tools: [
    defineTool("checkThreshold", {
      description: "Check if a numeric value meets a minimum threshold",
      parameters: s.object({
        value: s.number,
        minimum: s.number,
        label: s.string,
      }),
      handler({ value, minimum, label }) {
        return { label, ok: value >= minimum, value, minimum };
      },
    }),
  ],
  output: s.object({
    nodeVersion: s.string,
    os: s.string,
    memoryMb: s.number,
    health: s.enum("ok", "degraded", "critical"),
    issues: s.array(s.string),
  }),
});

export default runtimeEnvHealth;
```
