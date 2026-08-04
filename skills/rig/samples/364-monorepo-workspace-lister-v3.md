# 364 - Monorepo Workspace Lister V3

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const extractPackageInfo = defineTool("extractPackageInfo", {
  description: "Extract name, version, hasPrivate, and dependencyCount from a package.json file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const raw = await readFile(filePath, "utf8");
      const pkg = JSON.parse(raw);
      const depCount = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }).length;
      return {
        name: pkg.name ?? "unknown",
        version: pkg.version ?? "0.0.0",
        hasPrivate: pkg.private === true,
        dependencyCount: depCount,
      };
    } catch {
      return { name: "unknown", version: "0.0.0", hasPrivate: false, dependencyCount: 0 };
    }
  },
});

// Agent role: list all workspace packages in a monorepo with their metadata.
const monorepoWorkspaceLister = agent({
  model: "small",
  instructions: p`List all workspace packages in this monorepo.

Nested package.json files (excluding node_modules):
${p.bash("find . -name 'package.json' -mindepth 2 -maxdepth 4 -not -path '*/node_modules/*' 2>/dev/null || echo ''")}

Steps:
1. For each file path, call extractPackageInfo.
2. Build the packages array with name, version, path (the filePath), hasPrivate, and dependencyCount.
3. Set totalPackages = packages.length.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      version: s.string,
      path: s.path,
      hasPrivate: s.boolean,
      dependencyCount: s.number,
    })),
    totalPackages: s.number,
  }),
  tools: [extractPackageInfo],
  maxTurns: 6,
});

export default monorepoWorkspaceLister;
```
