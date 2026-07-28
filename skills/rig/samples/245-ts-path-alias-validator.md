# 245 - Ts Path Alias Validator

```rig
import { agent, p, s, defineTool } from "rig";
import { existsSync } from "node:fs";

const checkAlias = defineTool("checkAlias", {
  description: "Check whether a TypeScript path alias target directory exists on disk.",
  parameters: { alias: s.string, target: s.string },
  handler: ({ target }: { alias: string; target: string }) => {
    const resolved = target.replace(/\/\*$/, "");
    return existsSync(resolved) ? "valid" : "broken";
  },
});

// Agent role: validate all TypeScript path aliases defined in tsconfig.json against the workspace.
const tsPathAliasValidator = agent({
  model: "small",
  instructions: p`Validate TypeScript path aliases defined in tsconfig.json.

tsconfig.json: ${p.read("tsconfig.json")}
Import statements in .ts files: ${p.bash("grep -rh --include='*.ts' 'from \"' . 2>/dev/null | grep -v node_modules | sort -u | head -100")}

Steps:
1. Parse the compilerOptions.paths from tsconfig.json — each key is an alias pattern, values are target arrays.
2. For each alias, call checkAlias with the alias key and its first target path.
3. Check whether each alias is actually used in the import statements.
4. Set status: "broken" if target doesn't exist, "unused" if never imported, "valid" otherwise.
5. Count brokenCount as the number of broken aliases.`,
  output: s.object({
    aliases: s.record(s.object({
      target: s.string,
      status: s.enum("valid", "broken", "unused"),
    })),
    totalAliases: s.number,
    brokenCount: s.number,
  }),
  tools: [checkAlias],
  maxTurns: 6,
});

export default tsPathAliasValidator;
```
