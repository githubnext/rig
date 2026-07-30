import { agent, p, s, defineTool, repair } from "rig";

const validateScriptName = defineTool("validateScriptName", {
  description: "Validate that a package.json script name follows conventional naming (lowercase, hyphens only)",
  parameters: s.object({ name: s.string }),
  handler({ name }) {
    const valid = /^[a-z][a-z0-9:-]*$/.test(name);
    const reason = valid ? "Name is conventional" : "Name should be lowercase with hyphens/colons only";
    return { valid, reason };
  },
});

// Agent role: analyze package.json scripts for naming and structural health issues.
const packageScriptHealth = agent({
  model: "typecheck",
  instructions: p`Read ${p.read("package.json")} and analyze all scripts entries. Use the validateScriptName tool for each script name. Classify each issue by severity and determine overall health.`,
  output: s.object({
    issues: s.array(s.object({
      script: s.string,
      issue: s.string,
      status: s.enum("error", "warning", "ok"),
    })),
    overallHealth: s.enum("healthy", "degraded", "critical"),
  }),
  tools: [validateScriptName],
  maxTurns: 6,
  addons: repair(),
});

export default packageScriptHealth;

