# 372 - Workflow Input Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const validateWorkflowInputs = defineTool("validateWorkflowInputs", {
  description: "Parse a GitHub Actions workflow YAML file and extract workflow_dispatch inputs.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8");
    const inputsMatch = content.match(/workflow_dispatch:\s*\n(?:\s+.*\n)*?\s+inputs:([\s\S]*?)(?=\n\w|\n\s{0,2}\w|$)/);
    if (!inputsMatch) return { inputs: {}, inputCount: 0, hasRequiredWithoutDefault: false };
    const inputsBlock = inputsMatch[1];
    const inputEntries: Record<string, { type: string; required: boolean; default?: string | undefined }> = {};
    const inputPattern = /^\s{4,8}(\w+):\s*\n((?:\s{6,12}.+\n?)*)/gm;
    let match: RegExpExecArray | null;
    while ((match = inputPattern.exec(inputsBlock)) !== null) {
      const name = match[1];
      const block = match[2];
      const typeM = block.match(/type:\s*(.+)/);
      const requiredM = block.match(/required:\s*(true|false)/);
      const defaultM = block.match(/default:\s*(.+)/);
      inputEntries[name] = {
        type: typeM ? typeM[1].trim() : "string",
        required: requiredM ? requiredM[1] === "true" : false,
        default: defaultM ? defaultM[1].trim() : undefined,
      };
    }
    const inputCount = Object.keys(inputEntries).length;
    const hasRequiredWithoutDefault = Object.values(inputEntries).some(
      (v) => v.required && v.default === undefined
    );
    return { inputs: inputEntries, inputCount, hasRequiredWithoutDefault };
  },
});

// Agent role: validate GitHub Actions workflow_dispatch inputs across all workflow files.
const workflowInputValidator = agent({
  model: "small",
  instructions: p`Validate workflow_dispatch inputs in all GitHub Actions workflow files.

Workflow files:
${p.glob(".github/workflows/*.yml")}

Steps:
1. For each file path listed above, call validateWorkflowInputs to extract inputs, inputCount, hasRequiredWithoutDefault.
2. Build workflows record keyed by filename.
3. Set totalWorkflows to the count of workflow files processed.`,
  output: s.object({
    workflows: s.record(
      s.object({
        inputCount: s.int,
        hasRequiredWithoutDefault: s.boolean,
      })
    ),
    totalWorkflows: s.int,
  }),
  tools: [validateWorkflowInputs],
  addons: [repair()],
});

export default workflowInputValidator;
```
