# 146 - File Permission Scanner

```rig
import { agent, p, s, defineTool } from "rig";

const parsePermissions = defineTool("parsePermissions", {
  description: "Parse a unix permission string and classify risk level.",
  parameters: s.object({ permissions: s.string, filename: s.string }),
  handler({ permissions }) {
    const isExecutable = permissions[3] === "x" || permissions[6] === "x" || permissions[9] === "x";
    const isWorldWritable = permissions[8] === "w";
    let riskLevel: "safe" | "warn" | "danger" = "safe";
    if (isWorldWritable) riskLevel = "danger";
    else if (isExecutable) riskLevel = "warn";
    return { isExecutable, isWorldWritable, riskLevel };
  },
});

// Agent role: Scan workspace file permissions and flag dangerous or unusual access modes.
const filePermissionScanner = agent({
  model: "small",
  instructions: p`Scan file permissions in the workspace and classify risk.

List files with permissions:
${p.bash("find . -maxdepth 3 -type f ! -path '*/node_modules/*' ! -path '*/.git/*' | head -50 | xargs ls -la 2>/dev/null")}

For each file, use parsePermissions to determine isExecutable, isWorldWritable, and riskLevel.
Return s.object with files record (keyed by filename), dangerCount, and allSafe.`,
  tools: [parsePermissions],
  output: s.object({
    files: s.record(
      s.object({
        mode: s.string,
        isExecutable: s.boolean,
        isWorldWritable: s.boolean,
        riskLevel: s.enum("safe", "warn", "danger"),
      }),
    ),
    dangerCount: s.int,
    allSafe: s.boolean,
  }),
});

export default filePermissionScanner;
```
