# 379 - Os Env Variable Scanner

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyEnvVar = defineTool("classifyEnvVar", {
  description: "Classify an environment variable by its name and value into a category.",
  parameters: s.object({ name: s.string, value: s.string }),
  handler({ name }) {
    if (name === "PATH" || name.endsWith("_PATH") || name.endsWith("_HOME")) return "path" as const;
    if (name.startsWith("LANG") || name.startsWith("LC_")) return "locale" as const;
    if (name === "HOME" || name === "USER" || name === "USERNAME" || name === "LOGNAME") return "home" as const;
    if (name === "EDITOR" || name === "VISUAL" || name === "PAGER") return "editor" as const;
    if (name === "CI" || name.startsWith("GITHUB_") || name.startsWith("RUNNER_") || name.startsWith("ACTIONS_")) return "ci" as const;
    return "custom" as const;
  },
});

// Agent role: Scan all OS environment variables and categorize them by type.
const osEnvVariableScanner = agent({
  model: "small",
  instructions: p`Scan environment variables: ${p.bash("env")}. Use classifyEnvVar on each variable and return a summary.`,
  output: s.object({
    vars: s.record(s.object({ value: s.string, category: s.enum("path", "locale", "home", "editor", "ci", "custom") })),
    totalVars: s.int,
    ciEnvCount: s.int,
    customCount: s.int,
  }),
  tools: [classifyEnvVar],
  addons: [repair()],
});

export default osEnvVariableScanner;
```
