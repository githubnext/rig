# 495 - Dockerfile Env Inspector

```rig
import { agent, defineTool, p, s } from "rig";

const parseEnvInstruction = defineTool("parseEnvInstruction", {
  description: "Parse a Dockerfile ENV instruction line and extract key, value, and whether a default is set",
  parameters: s.object({ file: s.path, line: s.int, raw: s.string }),
  handler({ raw }) {
    const parts = raw.replace(/^ENV\s+/, "").split(/\s+|=/, 2);
    const key = parts[0] ?? "";
    const value = parts[1] ?? "";
    return { key, value, hasDefault: value.length > 0 };
  },
});

// Agent role: locate Dockerfiles and extract all ENV instructions with their key-value details.
const dockerfileEnvInspector = agent({
  model: "small",
  instructions: p`Find Dockerfiles using ${p.bash("find . -name 'Dockerfile*' -not -path '*/node_modules/*' 2>/dev/null | head -20 || true")}. Extract ENV instructions with ${p.bash("grep -rn '^ENV ' $(find . -name 'Dockerfile*' -not -path '*/node_modules/*' 2>/dev/null | head -10 | tr '\\n' ' ') 2>/dev/null || true")}. Use parseEnvInstruction for each ENV line found. Return all env vars.`,
  output: s.object({
    envVars: s.array(s.object({ key: s.string, value: s.string, hasDefault: s.boolean, file: s.path, line: s.int })),
    totalCount: s.int,
    dockerfileCount: s.int,
  }),
  tools: [parseEnvInstruction],
});

export default dockerfileEnvInspector;
```
