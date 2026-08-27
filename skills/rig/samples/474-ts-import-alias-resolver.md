# 474 - TS Import Alias Resolver

```rig
import { agent, defineTool, p, s, steering, repair } from "rig";

const resolveAlias = defineTool("resolveAlias", {
  description: "Resolve a TypeScript import alias prefix to its real path using tsconfig paths config.",
  parameters: s.object({
    aliasPrefix: s.string,
    tsconfigContent: s.string,
  }),
  handler: async ({ aliasPrefix, tsconfigContent }) => {
    try {
      const tsconfig = JSON.parse(tsconfigContent);
      const paths: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {};
      const key = Object.keys(paths).find((k: string) => k.startsWith(aliasPrefix.replace(/\*$/, "")));
      if (key) {
        const targets = paths[key] ?? [];
        return { realPath: targets[0]?.replace(/\*$/, "") ?? null, found: true };
      }
      return { realPath: null, found: false };
    } catch {
      return { realPath: null, found: false };
    }
  },
});

// Agent role: resolve TypeScript import aliases by reading tsconfig paths and grepping src/ for usages.
const tsImportAliasResolver = agent({
  model: "small",
  instructions: p`Read the project tsconfig: ${p.readOptional("tsconfig.json", "{}")}. Then check grep output: ${p.bash("grep -rn \"from '@\" src/ --include='*.ts' 2>/dev/null | head -100 || echo ''")}.  For each unique alias prefix found (e.g. @utils/, @lib/), call resolveAlias with the prefix and the tsconfig content. Count usages per alias and list the files. Return aliases as a record keyed by prefix, plus totalAliasUsages and unmappedAliases (aliases not found in tsconfig).`,
  output: s.object({
    aliases: s.record(s.object({
      realPath: s.optional(s.string),
      usageCount: s.int,
      files: s.array(s.string),
    })),
    totalAliasUsages: s.int,
    unmappedAliases: s.array(s.string),
  }),
  tools: [resolveAlias],
  maxTurns: 6,
  addons: [steering(), repair()],
});

export default tsImportAliasResolver;
```
