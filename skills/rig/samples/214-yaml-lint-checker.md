# 214 - Yaml Lint Checker

```rig
import { agent, p, s, defineTool } from "rig";

const validateYaml = defineTool("validateYaml", {
  description: "Validate a YAML file for structural issues, especially GitHub Actions required keys",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const text = await readFile(filePath, "utf8");
      const lines = text.split("\n");
      const lineCount = lines.length;
      const issues: string[] = [];
      const topKeys = lines.filter((l: string) => /^[a-zA-Z]/.test(l)).map((l: string) => l.split(":")[0].trim());
      const isGhAction = topKeys.includes("on") || topKeys.includes("jobs");
      if (isGhAction) {
        if (!topKeys.includes("name")) issues.push("missing top-level 'name' key");
        if (!topKeys.includes("on")) issues.push("missing top-level 'on' trigger");
        if (!topKeys.includes("jobs")) issues.push("missing top-level 'jobs' key");
      }
      const status = issues.length === 0 ? "pass" : issues.length <= 1 ? "warn" : "fail";
      return { issues, lineCount, status };
    } catch (e) {
      return { issues: [`read error: ${e}`], lineCount: 0, status: "fail" };
    }
  },
});

// Agent role: find YAML files in the workspace and validate each for structural correctness.
const yamlLintChecker = agent({
  model: "small",
  instructions: p`Find all YAML files in this project: ${p.bash("find . \\( -name '*.yml' -o -name '*.yaml' \\) -not -path '*/node_modules/*' | head -30")}. Use the validateYaml tool on each file path. Return a record keyed by filename with issues, lineCount, and status for each file.`,
  output: s.record(s.object({
    issues: s.array(s.string),
    lineCount: s.int,
    status: s.enum("pass", "warn", "fail"),
  })),
  tools: [validateYaml],
  maxTurns: 5,
});

export default yamlLintChecker;
```
