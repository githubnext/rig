# 380 - NPM Peer Dep Conflict Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkPeerConflict = defineTool("checkPeerConflict", {
  description: "Check whether a package version satisfies the expected peer dependency range.",
  parameters: s.object({
    packageName: s.string,
    expectedRange: s.string,
    foundVersion: s.string,
  }),
  handler({ expectedRange, foundVersion }) {
    if (!foundVersion) {
      return { conflicting: true, reason: "Package not installed", severity: "error" as const };
    }
    // Simple semver major check
    const expectedMajor = parseInt(expectedRange.replace(/[^0-9]/, ""), 10);
    const foundMajor = parseInt(foundVersion.replace(/[^0-9]/, ""), 10);
    if (!isNaN(expectedMajor) && !isNaN(foundMajor) && foundMajor !== expectedMajor) {
      return { conflicting: true, reason: `Expected major ${expectedMajor}, found ${foundMajor}`, severity: "error" as const };
    }
    return { conflicting: false, reason: undefined, severity: "ok" as const };
  },
});

// Agent role: identify peer dependency conflicts in the current npm project.
const npmPeerDepConflictChecker = agent({
  model: "small",
  instructions: p`Check for peer dependency conflicts in the npm project.

package.json:
${p.read("package.json")}

npm dependency tree (may contain WARN lines about peer conflicts):
${p.bash("npm ls --json 2>&1 | head -200")}

For each peerDependency entry in package.json, identify what version is actually installed from the npm ls output.
Call checkPeerConflict with packageName, expectedRange (from peerDependencies), and foundVersion (from npm ls or empty string if missing).
Return conflicts (array of packages with conflicting status), totalConflicts (count of conflicting: true),
hasErrors (any severity === "error"), hasPeerDeps (peerDependencies field exists and is non-empty).`,
  tools: [checkPeerConflict],
  output: s.object({
    conflicts: s.array(
      s.object({
        package: s.string,
        expected: s.string,
        found: s.optional(s.string),
        severity: s.enum("error", "warning", "ok"),
      })
    ),
    totalConflicts: s.int,
    hasErrors: s.boolean,
    hasPeerDeps: s.boolean,
  }),
  maxTurns: 5,
  addons: repair(),
});

export default npmPeerDepConflictChecker;

```
