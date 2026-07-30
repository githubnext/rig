import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const validateWorkflow = defineTool("validateWorkflow", {
  description: "Validate a GitHub Actions workflow YAML file for required top-level keys.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const hasName = /^name:/m.test(content);
    const hasOn = /^on:/m.test(content);
    const hasJobs = /^jobs:/m.test(content);
    const issues: string[] = [];
    if (!hasName) issues.push("Missing 'name' key");
    if (!hasOn) issues.push("Missing 'on' key");
    if (!hasJobs) issues.push("Missing 'jobs' key");
    const status = issues.length === 0 ? "pass" : issues.length < 2 ? "warn" : "fail";
    return { hasName, hasOn, hasJobs, status, issues };
  },
});

// Agent role: lint GitHub Actions workflow YAML files for required top-level keys.
const yamlWorkflowLinter = agent({
  model: "typecheck",
  instructions: p`Validate each GitHub Actions workflow file found in the workspace.

Workflow files: ${p.glob(".github/workflows/**/*.yml")}

For each file path listed above, call the validateWorkflow tool to check for required keys.
Return a record keyed by filename with validation results.`,
  output: s.record(s.object({
    hasName: s.boolean,
    hasOn: s.boolean,
    hasJobs: s.boolean,
    status: s.enum("pass", "warn", "fail"),
    issues: s.array(s.string),
  })),
  tools: [validateWorkflow],
  addons: [repair()],
});

export default yamlWorkflowLinter;
