import { agent, p, s, defineTool } from "rig";
import { readFileSync } from "node:fs";

const validateYaml = defineTool("validateYaml", {
  description: "Validate a YAML file for structural issues and required top-level keys",
  parameters: s.object({ filePath: s.path }),
  handler({ filePath }) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      return { issues: ["File not readable"], lineCount: 0, status: "fail" as const };
    }
    const issues: string[] = [];
    const lines = content.split("\n");
    const lineCount = lines.length;
    const isWorkflow = filePath.includes(".github/workflows");
    if (isWorkflow) {
      if (!content.includes("name:")) issues.push("Missing 'name' key");
      if (!content.includes("on:") && !content.includes('"on":')) issues.push("Missing 'on' trigger");
      if (!content.includes("jobs:")) issues.push("Missing 'jobs' key");
    }
    if (content.includes("\t")) issues.push("Contains tab characters (use spaces in YAML)");
    const status = issues.length === 0 ? "pass" : issues.some((i: string) => i.startsWith("Missing")) ? "fail" : "warn";
    return { issues, lineCount, status } as { issues: string[]; lineCount: number; status: "pass" | "warn" | "fail" };
  },
});

// Agent role: lint YAML files and report structural issues per file.
const yamlWorkflowLinter = agent({
  model: "typecheck",
  instructions: p`Find YAML files: ${p.bash("find . \\( -name '*.yml' -o -name '*.yaml' \\) | grep -v node_modules | grep -v .git | head -20")}. For each file path, call validateYaml and collect the result. Return a record keyed by file path.`,
  output: s.record(s.object({
    issues: s.array(s.string),
    lineCount: s.int,
    status: s.enum("pass", "warn", "fail"),
  })),
  tools: [validateYaml],
});

export default yamlWorkflowLinter;
