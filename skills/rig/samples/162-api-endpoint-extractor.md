# 162 - API Endpoint Extractor

```rig
import { agent, p, s } from "rig";

// Agent role: classify purpose of each API endpoint found in route files.
const endpointClassifier = agent({
  name: "endpointClassifier",
  model: "nano",
  input: s.object({ route: s.string }),
  instructions: p`Classify this API route: return purpose and description.`,
  output: s.object({
    purpose: s.enum("read", "write", "delete", "auth", "health", "other"),
    description: s.string,
  }),
});

// Agent role: extract API endpoints from route/controller files and classify each by purpose.
const apiEndpointExtractor = agent({
  model: "small",
  agents: { endpointClassifier },
  instructions: p`Extract and classify all API endpoints in this workspace.

Route patterns found:
${p.bash("grep -rn '\\.(get|post|put|delete|patch)(' --include='*.ts' --include='*.js' . 2>/dev/null | grep -v node_modules | head -40")}

For each unique route pattern found, delegate to the endpointClassifier subagent to determine its purpose. Return all discovered endpoints with method, path, and purpose. Return only the declared output.`,
  output: s.object({
    endpoints: s.array(s.object({
      method: s.enum("GET", "POST", "PUT", "DELETE", "PATCH"),
      path: s.string,
      purpose: s.enum("read", "write", "delete", "auth", "health", "other"),
    })),
    totalCount: s.int,
    hasCrud: s.boolean,
  }),
});

export default apiEndpointExtractor;
```
