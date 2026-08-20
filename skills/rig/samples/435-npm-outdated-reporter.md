# 435 - NPM Outdated Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyUpdateSeverity = defineTool("classifyUpdateSeverity", {
  description: "Classify npm dependency update severity based on version difference",
  parameters: s.object({ name: s.string, current: s.string, latest: s.string }),
  handler: async ({ current, latest }) => {
    const parseParts = (v: string) => v.replace(/^[^0-9]*/, "").split(".").map(Number);
    const [curMajN, curMinN] = parseParts(current);
    const [latMajN, latMinN] = parseParts(latest);
    const severity: "major" | "minor" | "patch" =
      latMajN > curMajN ? "major" : latMinN > curMinN ? "minor" : "patch";
    return { severity };
  },
});

// Agent role: Report outdated npm dependencies with classified update severity.
const npmOutdatedReporter = agent({
  name: "npm-outdated-reporter",
  model: "small",
  maxTurns: 5,
  instructions: p`You are an npm dependency reporter. Here is the output of npm outdated:
${p.bash("npm outdated --json 2>/dev/null || echo '{}'")}

For each package, call classifyUpdateSeverity with name, current, and latest versions. Then return packages array with name/current/latest/severity, and majorCount/minorCount/patchCount integers.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      current: s.string,
      latest: s.string,
      severity: s.enum("major", "minor", "patch"),
    })),
    majorCount: s.int,
    minorCount: s.int,
    patchCount: s.int,
  }),
  tools: [classifyUpdateSeverity],
  addons: [repair()],
});

export default npmOutdatedReporter;
```
