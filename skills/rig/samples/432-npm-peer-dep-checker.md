# npm-peer-dep-checker - NPM Peer Dep Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkPeerConflict = defineTool("checkPeerConflict", {
  description: "Classify a peer dependency as conflicting, warn, or ok.",
  parameters: s.object({
    package: s.string,
    required: s.string,
    installed: s.optional(s.string),
  }),
  handler: async ({ installed, required }) => {
    if (!installed) {
      return { conflicting: true, reason: "Package not installed", severity: "error" as const };
    }
    const [reqMajor] = required.replace(/[\^~>=<]/g, "").split(".");
    const [instMajor] = installed.replace(/[\^~>=<]/g, "").split(".");
    if (reqMajor !== instMajor) {
      return { conflicting: true, reason: `Major version mismatch: required ${required}, installed ${installed}`, severity: "error" as const };
    }
    return { conflicting: false, reason: "Compatible", severity: "ok" as const };
  },
});

// Agent role: check npm peer dependency conflicts in the current project.
const npmPeerDepChecker = agent({
  model: "small",
  output: s.object({
    conflicts: s.array(s.object({
      package: s.string,
      reason: s.string,
      severity: s.enum("error", "warning", "ok"),
    })),
    totalConflicts: s.int,
    hasErrors: s.boolean,
    hasPeerDeps: s.boolean,
  }),
  instructions: p`Review ${p.read("package.json")} and run ${p.bash("npm ls --json 2>&1 || true")} to identify peer dependency conflicts. For each peerDependency call checkPeerConflict with the package name, required version, and installed version. Return the list of conflicts, totalConflicts, hasErrors, and hasPeerDeps.`,
  tools: [checkPeerConflict],
  addons: [repair()],
});

export default npmPeerDepChecker;
```
