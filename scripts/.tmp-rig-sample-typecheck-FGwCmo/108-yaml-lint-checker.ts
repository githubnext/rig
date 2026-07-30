import { agent, p, s, defineTool } from "rig";

const validateYaml = defineTool("validateYaml", {
  description: "Structurally validate a YAML file's content for common issues and required top-level keys",
  parameters: s.object({ filename: s.string, content: s.string }),
  handler({ filename, content }) {
    const issues: string[] = [];
    const lines = content.split("\n");
    const lineCount = lines.length;
    const isWorkflow = filename.includes(".github/workflows");
    if (isWorkflow) {
      if (!content.includes("name:")) issues.push("Missing 'name' key");
      if (!content.includes("on:") && !content.includes("\"on\":")) issues.push("Missing 'on' trigger");
      if (!content.includes("jobs:")) issues.push("Missing 'jobs' key");
    }
    if (content.includes("\t")) issues.push("Contains tab characters (use spaces in YAML)");
    const trailingWhitespace = lines.filter((l: string) => l !== l.trimEnd()).length;
    if (trailingWhitespace > 0) issues.push(`${trailingWhitespace} lines with trailing whitespace`);
    const status = issues.length === 0 ? "pass" : issues.some((i: string) => i.startsWith("Missing")) ? "fail" : "warn";
    return { issues, lineCount, status };
  },
});

// Agent role: lint YAML files in the repository and report structural issues.
const yamlLintChecker = agent({
  model: "typecheck",
  instructions: p`Find YAML files in this repository: ${p.bash("find . -name '*.yml' -o -name '*.yaml' | grep -v node_modules | grep -v .git | head -20")}. For each file, read its content and use the validateYaml tool to check for structural issues. Compile results keyed by relative file path.`,
  output: s.record(s.object({
    issues: s.array(s.string),
    lineCount: s.number,
    status: s.enum("pass", "warn", "fail"),
  })),
  tools: [validateYaml],
});

export default yamlLintChecker;
