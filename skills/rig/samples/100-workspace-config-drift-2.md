# 100 - Workspace Config Drift 2

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseJson = defineTool("parseJson", {
  description: "Parse a JSON string and return parsed object or error",
  parameters: s.object({ content: s.string, filename: s.string }),
  handler({ content, filename }) {
    try {
      return { ok: true, parsed: JSON.parse(content), filename };
    } catch (e) {
      return { ok: false, error: String(e), filename };
    }
  },
});

// Agent role: detect configuration drift across workspace config files.
const workspaceConfigDrift = agent({
  model: "small",
  instructions: p`Read and analyze these config files: tsconfig.json ${p.readOptional("tsconfig.json", "{}")}, .eslintrc.json ${p.readOptional(".eslintrc.json", "{}")}, .prettierrc ${p.readOptional(".prettierrc", "{}")}. Use the parseJson tool to validate each. For each config file, identify fields that deviate from sensible defaults (e.g. missing strict mode in tsconfig, missing semi in prettier). Return a record keyed by filename with driftedFields and status.`,
  output: s.record(s.object({
    driftedFields: s.array(s.string),
    status: s.enum("ok", "warning", "error"),
  })),
  tools: [parseJson],
  maxTurns: 4,
  addons: repair(),
});

export default workspaceConfigDrift;
```
