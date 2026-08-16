# 429 - Package Json Field Auditor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkFieldPresence = defineTool("checkFieldPresence", {
  description: "Check whether a field is present, absent, or malformed in a parsed package.json object.",
  parameters: s.object({ fieldName: s.string, packageJson: s.unknown }),
  handler({ fieldName, packageJson }: { fieldName: string; packageJson: unknown }) {
    const pkg = packageJson as Record<string, unknown>;
    if (!(fieldName in pkg)) return { status: "absent" as const, value: undefined };
    const val = pkg[fieldName];
    if (val === null || val === undefined || val === "") return { status: "malformed" as const, value: String(val) };
    return { status: "present" as const, value: typeof val === "string" ? val : JSON.stringify(val) };
  },
});

// Agent role: audit package.json for presence and completeness of standard fields.
const packageJsonFieldAuditor = agent({
  model: "small",
  instructions: p`Audit package.json for presence and quality of standard fields.

package.json contents:
${p.read("package.json")}

Standard fields to check: name, version, description, main, types, exports, license, repository, keywords.

For each field, call checkFieldPresence with the field name and the full parsed package.json.
Build fields record keyed by field name.
presentCount = fields where status === "present".
absentCount = fields where status === "absent".
totalChecked = 9.
completenessScore = presentCount / totalChecked (range 0.0 to 1.0).`,
  output: s.object({
    fields: s.record(s.object({
      status: s.enum("present", "absent", "malformed"),
      value: s.optional(s.string),
    })),
    presentCount: s.int,
    absentCount: s.int,
    totalChecked: s.int,
    completenessScore: s.number,
  }),
  tools: [checkFieldPresence],
  addons: [repair()],
});

export default packageJsonFieldAuditor;
```
