import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractPackageInfo = defineTool("extractPackageInfo", {
  description: "Read a nested package.json and extract name, version, and dependency names.",
  parameters: { filePath: s.string },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const pkg = JSON.parse(content);
      const deps = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
      return {
        name: pkg.name ?? "(unnamed)",
        version: pkg.version ?? "0.0.0",
        dependencies: deps,
        hasPrivate: pkg.private === true,
      };
    } catch {
      return { name: "(error)", version: "0.0.0", dependencies: [], hasPrivate: false };
    }
  },
});

// Agent role: discover all workspace packages in a monorepo and list their metadata.
const monorepoWorkspaceLister = agent({
  model: "typecheck",
  instructions: p`Discover all nested package.json files in this monorepo and extract package metadata.

Nested package.json files (excluding node_modules):
${p.bash("find . -name 'package.json' -not -path '*/node_modules/*' -mindepth 2 -maxdepth 4 2>/dev/null")}

Steps:
1. For each file path in the list above, call extractPackageInfo to get its metadata.
2. Assemble the packages array with name, version, dependencies, and hasPrivate for each.
3. Set totalPackages to the length of the packages array.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      version: s.string,
      dependencies: s.array(s.string),
      hasPrivate: s.boolean,
    })),
    totalPackages: s.number,
  }),
  tools: [extractPackageInfo],
  maxTurns: 8,
  addons: [steering()],
});

export default monorepoWorkspaceLister;
