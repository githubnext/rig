# 253 - Package Version Drift

```rig
import { agent, p, s } from "rig";

// Agent role: compare installed npm package versions against the latest published versions and classify drift
const pkgVersionDrift = agent({
  name: "pkgVersionDrift",
  model: "small",
  instructions: p`Report npm package version drift for this project.

Package manifest: ${p.read("package.json")}

Outdated packages (JSON): ${p.bash("npm outdated --json 2>/dev/null || echo '{}'")}

For each dependency, classify driftLevel:
- ok: current matches latest
- patch: only patch version behind
- minor: minor version behind
- major: major version behind

Write a markdown drift summary report.
${p.writeOutput("report", "version-drift-report.md")}`,
  output: s.object({
    packages: s.array(
      s.object({
        name: s.string,
        current: s.string,
        latest: s.string,
        driftLevel: s.enum("ok", "patch", "minor", "major"),
      })
    ),
    report: s.string,
    reportWritten: s.boolean,
  }),
});

export default pkgVersionDrift;
```
