# 79 - Ts Type Alias Mapper

```rig
import { agent, p, s, defineTool } from "rig";

const categorizeAlias = defineTool("categorizeAlias", {
  description: "Categorize a TypeScript type alias definition by its kind using regex",
  parameters: s.object({ definition: s.string }),
  handler({ definition }) {
    const trimmed = definition.trim();
    if (/=\s*\w+\s*\|/.test(trimmed)) return { kind: "union" };
    if (/=\s*\w+\s*&/.test(trimmed)) return { kind: "intersection" };
    if (/=\s*\{[^}]*\[[^\]]+\]/.test(trimmed)) return { kind: "mapped" };
    if (/=\s*(string|number|boolean|null|undefined|never|any|unknown)\s*$/.test(trimmed)) return { kind: "primitive" };
    return { kind: "other" };
  },
});

// Agent role: scan TypeScript files for type alias declarations and categorize each one.
const tsTypeAliasMapper = agent({
  model: "small",
  instructions: p`Find all TypeScript files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*'")} and scan their contents: ${p.bash("grep -rn 'type [A-Z]' --include='*.ts' --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null || true")}. Use the categorizeAlias tool to classify each type alias. For each alias, also record whether it is exported (starts with 'export type').`,
  output: s.record(s.object({
    kind: s.enum("primitive", "union", "intersection", "mapped", "other"),
    exported: s.boolean,
  })),
  tools: [categorizeAlias],
});

export default tsTypeAliasMapper;
```
