import { agent, p, s, defineTool } from "rig";
import { existsSync } from "node:fs";

const checkAlias = defineTool("checkAlias", {
  description: "Check whether a TypeScript path alias target directory exists",
  parameters: s.object({ alias: s.string, target: s.string }),
  handler: ({ alias, target }) => {
    const resolved = target.replace(/\/\*$/, "");
    const exists = existsSync(resolved);
    return JSON.stringify({ alias, target, exists });
  },
});

// Agent role: validate TypeScript path aliases from tsconfig against actual filesystem paths.
const tsPathAliasValidator = agent({
  model: "typecheck",
  instructions: p`Validate TypeScript path alias configuration.

tsconfig.json: ${p.read("tsconfig.json")}

Files with aliased imports: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | xargs grep -l 'from [\"\\x27]' 2>/dev/null | head -20")}

Import alias usage: ${p.bash("grep -r --include='*.ts' -h 'from [\"\\x27]' . 2>/dev/null | grep -v node_modules | grep -v '\\.' | head -40")}

For each alias in compilerOptions.paths, use checkAlias to verify the target exists. Classify as valid (exists and used), broken (target missing), or unused (exists but no imports found). Report totalAliases and brokenCount.`,
  output: s.object({
    aliases: s.record(s.object({
      target: s.string,
      status: s.enum("valid", "broken", "unused"),
    })),
    totalAliases: s.int,
    brokenCount: s.int,
  }),
  tools: [checkAlias],
});

export default tsPathAliasValidator;
