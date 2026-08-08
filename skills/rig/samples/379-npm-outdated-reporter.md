# 379 - NPM Outdated Reporter

```rig
import { agent, defineTool, p, s, repair } from "rig";

const classifyUpdateSeverity = defineTool("classifyUpdateSeverity", {
  description: "Classify a package version update as major, minor, or patch",
  parameters: s.object({
    current: s.string("current installed version"),
    latest: s.string("latest available version"),
  }),
  handler({ current, latest }) {
    const parse = (v: string) => v.replace(/^[^0-9]*/, "").split(".").map(Number);
    const [curMajor] = parse(current);
    const [latMajor, latMinor] = parse(latest);
    const [, curMinor] = parse(current);
    if (latMajor > curMajor) return "major" as const;
    if (latMinor > curMinor) return "minor" as const;
    return "patch" as const;
  },
});

// Agent role: report outdated npm packages and classify each update by severity.
const npmOutdatedReporter = agent({
  model: "small",
  instructions: p`Check for outdated npm packages:
${p.bash("npm outdated --json 2>/dev/null || echo '{}'")}

For each outdated package, use classifyUpdateSeverity with its current and latest versions. Determine if it is a breaking change (major updates are breaking).

Return the output schema with packages record, majorCount, minorCount, and patchCount.`,
  output: s.object({
    packages: s.record(s.object({
      current: s.string,
      wanted: s.string,
      latest: s.string,
      severity: s.enum("major", "minor", "patch"),
      isBreaking: s.boolean,
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
