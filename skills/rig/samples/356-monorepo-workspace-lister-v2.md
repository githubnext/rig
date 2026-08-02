# 356 - Monorepo Workspace Lister V2

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractPackageInfo = defineTool("extractPackageInfo", {
  description: "Read a nested package.json and extract name, version, dependency count, and private flag.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const pkg = JSON.parse(content);
      const dependencyCount =
        Object.keys(pkg.dependencies ?? {}).length +
        Object.keys(pkg.devDependencies ?? {}).length;
      return {
        name: (pkg.name ?? "(unnamed)") as string,
        version: (pkg.version ?? undefined) as string | undefined,
        dependencyCount,
        hasPrivate: pkg.private === true,
      };
    } catch {
      return { name: "(error)", version: undefined, dependencyCount: 0, hasPrivate: false };
    }
  },
});

// Agent role: discover all workspace packages in a monorepo and list their metadata.
const monorepoWorkspaceLister = agent({
  model: "small",
  instructions: p`Discover all nested package.json files in this monorepo and extract package metadata.

Nested package.json paths (excluding node_modules):
${p.bash("find . -name 'package.json' -not -path '*/node_modules/*' -mindepth 2 -maxdepth 4 2>/dev/null")}

Steps:
1. For each file path in the list above, call extractPackageInfo to get its metadata.
2. Assemble the packages array with name, version (optional), dependencyCount, hasPrivate, and path for each.
3. Set totalPackages to the length of the packages array.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      version: s.optional(s.string),
      dependencyCount: s.int,
      hasPrivate: s.boolean,
      path: s.path,
    })),
    totalPackages: s.int,
  }),
  tools: [extractPackageInfo],
  maxTurns: 8,
  addons: [steering()],
});

export default monorepoWorkspaceLister;

```
