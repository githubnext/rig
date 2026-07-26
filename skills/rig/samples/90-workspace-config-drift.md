# 90 - Workspace Config Drift

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseJson = defineTool("parseJson", {
  description: "Parse a JSON string and return it, or report a parse error",
  parameters: s.object({ content: s.string, filename: s.string }),
  handler({ content, filename }) {
    try {
      const parsed = JSON.parse(content);
      return { ok: true, parsed };
    } catch (e) {
      return { ok: false, error: String(e), filename };
    }
  },
});

// Agent role: detect drift in workspace config files by reading them and comparing against known defaults.
const workspaceConfigDrift = agent({
  model: "small",
  instructions: p`Read project config files: ${p.readOptional("tsconfig.json", "{}")} (tsconfig.json), ${p.readOptional(".eslintrc.json", "{}")} (.eslintrc.json), ${p.readOptional(".prettierrc", "{}")} (.prettierrc). Use the parseJson tool to parse each file. For each config, identify fields that deviate from sensible defaults and report them as drifted. Assign status ok if no drift, warning for minor issues, error for significant mismatches.`,
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
