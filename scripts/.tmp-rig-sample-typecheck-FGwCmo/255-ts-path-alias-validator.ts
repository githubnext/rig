import { agent, p, s, defineTool } from "rig";
import { existsSync } from "node:fs";

const checkAlias = defineTool("checkAlias", {
  description: "Check whether a TypeScript path alias target exists on the filesystem",
  parameters: s.object({ alias: s.string, target: s.string }),
  handler: ({ alias, target }) => {
    const resolved = target.replace(/\/\*$/, "");
    const exists = existsSync(resolved);
    return JSON.stringify({ alias, target, exists });
  },
});

// Agent role: validate TypeScript path alias targets from tsconfig.json against the filesystem
const tsPathAliasValidator = agent({
  name: "tsPathAliasValidator",
  model: "typecheck",
  tools: [checkAlias],
  instructions: p`Validate TypeScript path aliases defined in tsconfig.json.

tsconfig.json: ${p.read("tsconfig.json")}

Import alias usage in source: ${p.bash("grep -r --include='*.ts' -h 'from [\"\\x27]' . 2>/dev/null | grep -v node_modules | grep -v '\\./' | grep -v '\\.\\./' | head -40")}

For each entry in compilerOptions.paths, call checkAlias with the alias pattern and its first target path.
Classify each alias:
- valid: target exists on disk and alias is used in imports
- broken: target path does not exist
- unused: target exists but alias not found in any imports

Report totalAliases and brokenCount.`,
  output: s.object({
    aliases: s.record(
      s.object({
        target: s.string,
        status: s.enum("valid", "broken", "unused"),
      })
    ),
    totalAliases: s.int,
    brokenCount: s.int,
  }),
});

export default tsPathAliasValidator;
