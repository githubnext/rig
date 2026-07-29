# 297-workflow-input-validator - Workflow Input Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const validateWorkflowInputs = defineTool("validateWorkflowInputs", {
  description: "Parse workflow_dispatch inputs from a GitHub Actions workflow YAML file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const inputSection = content.match(/workflow_dispatch:[\s\S]*?inputs:([\s\S]*?)(?=\n\S|\n\w+:|\n  [a-z]+:(?!\s*\n\s+type:)|\Z)/)?.[1] ?? "";
    const inputMatches = [...inputSection.matchAll(/^\s{6}(\w[\w-]*):/gm)];
    const inputs = inputMatches.map((m: RegExpMatchArray) => {
      const name = m[1];
      const block = inputSection.slice(m.index ?? 0, (m.index ?? 0) + 300);
      const type = block.match(/type:\s*(\w+)/)?.[1] ?? "string";
      const required = /required:\s*true/.test(block);
      const hasDefault = /default:/.test(block);
      return { name, type, required, hasDefault };
    });
    return {
      inputs,
      inputCount: inputs.length,
      hasRequiredWithoutDefault: inputs.some((i: { required: boolean; hasDefault: boolean }) => i.required && !i.hasDefault),
    };
  },
});

// Agent role: validate GitHub Actions workflow_dispatch inputs across all workflow files
const workflowInputValidator = agent({
  model: "small",
  instructions: p`Validate workflow_dispatch inputs in all workflow files discovered at ${p.glob(".github/workflows/*.yml")}. Use the validateWorkflowInputs tool for each file path. Return a record keyed by filename and the total workflow count.`,
  output: s.object({
    workflows: s.record(s.object({
      inputs: s.array(s.object({
        name: s.string,
        type: s.string,
        required: s.boolean,
        hasDefault: s.boolean,
      })),
      inputCount: s.int,
      hasRequiredWithoutDefault: s.boolean,
    })),
    totalWorkflows: s.int,
  }),
  tools: [validateWorkflowInputs],
  addons: [repair()],
});

export default workflowInputValidator;
```
