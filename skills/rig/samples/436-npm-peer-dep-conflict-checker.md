# 436 - NPM Peer Dep Conflict Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const detectPeerConflict = defineTool("detectPeerConflict", {
  description: "Check if an installed package version satisfies the expected peer dependency range.",
  parameters: s.object({
    packageName: s.string,
    requiredVersion: s.string,
    installedVersion: s.string,
  }),
  handler({ requiredVersion, installedVersion }: { packageName: string; requiredVersion: string; installedVersion: string }) {
    if (!installedVersion) {
      return { hasConflict: true, severity: "error" as const, message: "Package not installed" };
    }
    const reqMajor = parseInt(requiredVersion.replace(/[^0-9]/, ""), 10);
    const instMajor = parseInt(installedVersion.replace(/[^0-9]/, ""), 10);
    if (!isNaN(reqMajor) && !isNaN(instMajor) && reqMajor !== instMajor) {
      return { hasConflict: true, severity: "error" as const, message: `Expected major ${reqMajor}, found ${instMajor}` };
    }
    if (requiredVersion.startsWith(">") || requiredVersion.startsWith("^") || requiredVersion.startsWith("~")) {
      return { hasConflict: false, severity: "none" as const, message: "Compatible" };
    }
    return { hasConflict: false, severity: "none" as const, message: "Satisfied" };
  },
});

// Agent role: identify peer dependency conflicts in the current npm project.
const npmPeerDepConflictChecker = agent({
  model: "small",
  instructions: p`Check for peer dependency conflicts in the npm project.

package.json:
${p.read("package.json")}

npm dependency tree:
${p.bash("npm ls --json 2>&1 | head -200")}

1. Extract peerDependencies from package.json.
2. For each peer dep, find its installed version from the npm ls output.
3. Call detectPeerConflict with packageName, requiredVersion (from peerDependencies), and installedVersion.
4. Build conflicts array. Set totalConflicts to count of entries with hasConflict true.
5. summary: one-sentence overview of the conflict status.`,
  tools: [detectPeerConflict],
  output: s.object({
    totalPeerDeps: s.int,
    conflictsFound: s.int,
    conflicts: s.array(
      s.object({
        package: s.string,
        required: s.string,
        installed: s.optional(s.string),
        severity: s.enum("none", "warning", "error"),
      })
    ),
    summary: s.string,
  }),
  maxTurns: 5,
  addons: [repair()],
});

export default npmPeerDepConflictChecker;
```
