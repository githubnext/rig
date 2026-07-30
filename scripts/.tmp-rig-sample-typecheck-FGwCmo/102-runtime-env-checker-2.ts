import { agent, p, s, defineTool } from "rig";

const checkThresholds = defineTool("checkThresholds", {
  description: "Validate Node.js version and heap against minimum thresholds",
  parameters: s.object({ nodeVersion: s.string, heapMB: s.number }),
  handler({ nodeVersion, heapMB }) {
    const issues: string[] = [];
    const major = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
    if (major < 18) issues.push(`Node.js ${nodeVersion} is below v18 minimum`);
    if (heapMB < 256) issues.push(`Heap ${heapMB}MB is below 256MB minimum`);
    return { issues };
  },
});

// Agent role: inspect the runtime environment and report overall health.
const runtimeEnvChecker = agent({
  model: "typecheck",
  instructions: p`Inspect the runtime environment: Node version ${p.bash("node --version")}, OS info ${p.bash("uname -a")}, and heap memory ${p.bash("node -p \"Math.round(process.memoryUsage().heapTotal/1024/1024)\"")}MB. Use the checkThresholds tool to validate. Report health as ok, degraded, or critical.`,
  output: s.object({
    health: s.enum("ok", "degraded", "critical"),
    nodeVersion: s.string,
    platform: s.string,
    heapMB: s.number,
    issues: s.array(s.string),
  }),
  tools: [checkThresholds],
});

export default runtimeEnvChecker;
