# os-env-scanner - OS Environment Variable Scanner

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyEnvVar = defineTool("classifyEnvVar", {
  description: "Classify an OS environment variable by category.",
  parameters: s.object({
    name: s.string,
    value: s.string,
  }),
  handler: async ({ name }) => {
    if (/^(PATH|LD_LIBRARY_PATH|DYLD_LIBRARY_PATH|MANPATH|PKG_CONFIG_PATH)$/i.test(name)) {
      return { category: "path" as const };
    }
    if (/^(LANG|LANGUAGE|LC_\w+)$/i.test(name)) {
      return { category: "locale" as const };
    }
    if (/^(HOME|USER|LOGNAME|SHELL|USERNAME)$/i.test(name)) {
      return { category: "home" as const };
    }
    if (/^(EDITOR|VISUAL|PAGER|BROWSER)$/i.test(name)) {
      return { category: "editor" as const };
    }
    if (/^(CI|GITHUB_|JENKINS_|TRAVIS|CIRCLECI|GITLAB_CI|BUILD_|RUNNER_)/i.test(name)) {
      return { category: "ci" as const };
    }
    return { category: "custom" as const };
  },
});

// Agent role: scan OS environment variables and categorize them.
const osEnvScanner = agent({
  model: "small",
  output: s.object({
    vars: s.record(s.object({
      value: s.string,
      category: s.enum("path", "locale", "home", "editor", "ci", "custom"),
    })),
    totalVars: s.int,
    ciEnvCount: s.int,
    customCount: s.int,
  }),
  instructions: p`List all environment variables with ${p.bash("env")}. For each variable call classifyEnvVar with its name and value. Return a vars record keyed by variable name, plus totalVars, ciEnvCount (count of ci-category vars), and customCount (count of custom-category vars).`,
  tools: [classifyEnvVar],
  addons: [repair()],
});

export default osEnvScanner;
```
