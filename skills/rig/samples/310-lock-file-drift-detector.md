# 310 - Lock File Drift Detector

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: detect version drift between package.json dependencies and package-lock.json locked versions.
const lockFileDriftDetector = agent({
  model: "small",
  instructions: p`You are a lock file drift detector.

Read the package files:
${p.bash("cat package.json 2>/dev/null || echo '{}'")}
${p.bash("cat package-lock.json 2>/dev/null || echo '{}'")}

Use the checkVersionDrift tool to cross-check declared vs locked versions for each dependency.
Return the declared output.`,
  tools: [
    defineTool("checkVersionDrift", {
      description: "Parse package.json and package-lock.json content and return drifted packages",
      parameters: s.object({
        packageJsonContent: s.string,
        lockFileContent: s.string,
      }),
      handler({ packageJsonContent, lockFileContent }) {
        let pkg: Record<string, unknown>;
        let lock: Record<string, unknown>;
        try {
          pkg = JSON.parse(packageJsonContent) as Record<string, unknown>;
        } catch {
          return { error: "Failed to parse package.json" };
        }
        try {
          lock = JSON.parse(lockFileContent) as Record<string, unknown>;
        } catch {
          return { error: "Failed to parse package-lock.json" };
        }
        const deps = {
          ...((pkg["dependencies"] as Record<string, string>) ?? {}),
          ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
        };
        const lockPackages = (lock["packages"] as Record<string, { version?: string }>) ?? {};
        const drifted: Array<{ name: string; declared: string; locked: string }> = [];
        for (const [name, declared] of Object.entries(deps)) {
          const lockKey = `node_modules/${name}`;
          const lockedEntry = lockPackages[lockKey];
          const locked = lockedEntry?.version ?? "missing";
          const declaredClean = (declared as string).replace(/^[\^~>=<]/, "");
          if (locked !== declaredClean && locked !== "missing") continue;
          if (locked === "missing") {
            drifted.push({ name, declared: declared as string, locked });
          }
        }
        return { drifted };
      },
    }),
  ],
  output: s.object({
    driftedPackages: s.array(s.object({
      name: s.string,
      declared: s.string,
      locked: s.string,
    })),
    driftCount: s.int,
    allInSync: s.boolean,
  }),
  addons: [repair()],
});

export default lockFileDriftDetector;
```
