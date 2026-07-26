# 187 - Lock File Drift Detector

```rig
import { agent, defineTool, p, s, repair } from "rig";

const crossCheckVersions = defineTool("crossCheckVersions", {
  description: "Cross-check declared package.json versions against package-lock.json resolved versions",
  parameters: s.object({ packageJson: s.string, lockJson: s.string }),
  handler({ packageJson, lockJson }) {
    try {
      const pkg = JSON.parse(packageJson);
      const lock = JSON.parse(lockJson);
      const declared: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      const lockPackages = lock.packages || {};
      const drifted: Array<{ name: string; declared: string; locked: string; severity: string }> = [];
      for (const [name, declaredVersion] of Object.entries(declared)) {
        const lockEntry = lockPackages[`node_modules/${name}`];
        if (!lockEntry) continue;
        const locked = lockEntry.version as string;
        const declStr = String(declaredVersion).replace(/^[\^~]/, "");
        if (locked !== declStr) {
          const [dMaj, dMin] = declStr.split(".").map(Number);
          const [lMaj, lMin] = locked.split(".").map(Number);
          const severity = lMaj !== dMaj ? "major" : lMin !== dMin ? "minor" : "patch";
          drifted.push({ name, declared: String(declaredVersion), locked, severity });
        }
      }
      return drifted;
    } catch (e) {
      return { error: String(e) };
    }
  },
});

// Agent role: detect version drift between package.json declarations and package-lock.json resolved versions.
const lockFileDriftDetector = agent({
  model: "small",
  addons: [repair()],
  tools: [crossCheckVersions],
  instructions: p`Read package.json: ${p.bash("cat package.json 2>/dev/null || echo '{}'")} and package-lock.json: ${p.bash("cat package-lock.json 2>/dev/null || echo '{}'")}. Call crossCheckVersions with both file contents to find drifted packages. Return driftedPackages list, total driftCount, and whether all packages are in sync.`,
  output: s.object({
    driftedPackages: s.array(s.object({
      name: s.string,
      declared: s.string,
      locked: s.string,
      severity: s.enum("patch", "minor", "major", "unknown"),
    })),
    driftCount: s.int,
    allInSync: s.boolean,
  }),
});

export default lockFileDriftDetector;
```
