# 243 - Package Version Drift

```rig
import { agent, p, s } from "rig";

// Agent role: report package version drift by comparing package.json with npm outdated results.
const packageVersionDrift = agent({
  model: "small",
  instructions: p`Analyze package version drift for this workspace.

package.json: ${p.read("package.json")}
npm outdated (JSON, may be empty if all current): ${p.bash("npm outdated --json 2>/dev/null || echo '{}'")}

Steps:
1. Parse the npm outdated JSON — each key is a package name with current/wanted/latest fields.
2. For each outdated package determine driftLevel:
   - "ok" if current === latest
   - "patch" if only patch differs
   - "minor" if minor version differs
   - "major" if major version differs
3. Write a markdown drift report to drift-report.md summarizing the table.
4. Set reportWritten to true after writing.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      current: s.string,
      latest: s.string,
      driftLevel: s.enum("ok", "patch", "minor", "major"),
    })),
    reportWritten: s.boolean,
  }),
});

export default packageVersionDrift;
```
