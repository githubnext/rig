# 418 - TypeScript Import Alias Resolver

```rig
import { agent, p, s, steering, defineTool } from "rig";

const resolveAlias = defineTool("resolveAlias", {
  description: "Look up an import alias prefix in tsconfig paths and return the real mapped path.",
  parameters: s.object({ aliasPrefix: s.string, tsconfigPathsJson: s.string }),
  handler: ({ aliasPrefix, tsconfigPathsJson }: { aliasPrefix: string; tsconfigPathsJson: string }) => {
    try {
      const paths = JSON.parse(tsconfigPathsJson) as Record<string, string[]>;
      for (const [pattern, targets] of Object.entries(paths)) {
        const base = pattern.replace("/*", "");
        if (aliasPrefix === base || aliasPrefix.startsWith(base + "/")) {
          return { realPath: targets[0]?.replace("/*", "") ?? null, found: true };
        }
      }
    } catch {
      // ignore parse errors
    }
    return { realPath: null, found: false };
  },
});

// Agent role: Discover TypeScript path alias usages in source files and resolve them via tsconfig.
const tsImportAliasResolver = agent({
  model: "small",
  instructions: p`tsconfig.json:
${p.readOptional("tsconfig.json")}

Import alias usages found in source files:
${p.bash("grep -r --include='*.ts' -h \"from ['\\\"][@~][^'\\\"]*['\\\"]\" src/ 2>/dev/null | head -50")}

Parse alias prefixes (e.g. @app, ~lib) from the import statements. Call resolveAlias for each unique prefix with the tsconfig paths JSON. Return aliases record keyed by prefix with realPath, usageCount, and files. Return totalAliasUsages and unmappedAliases list.`,
  tools: [resolveAlias],
  maxTurns: 5,
  output: s.object({
    aliases: s.record(s.object({
      realPath: s.optional(s.string),
      usageCount: s.int,
      files: s.array(s.string),
    })),
    totalAliasUsages: s.int,
    unmappedAliases: s.array(s.string),
  }),
  addons: [steering()],
});

export default tsImportAliasResolver;

```
