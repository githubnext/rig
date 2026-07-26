# 161 - OpenAPI Spec Validator

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: validate an OpenAPI spec file for structural correctness and report issues.
const openapiSpecValidator = agent({
  model: "small",
  instructions: p`Validate the OpenAPI specification in this workspace.

openapi.json content:
${p.readOptional("openapi.json")}

openapi.yaml content:
${p.readOptional("openapi.yaml")}

Use the checkStructure tool to validate the spec content. Check for: required fields (openapi version, info.title, info.version, paths), valid HTTP methods, proper response codes, and schema references. Return only the declared output.`,
  tools: [
    defineTool("checkStructure", {
      description: "Check structural validity of OpenAPI spec content",
      parameters: s.object({ content: s.string }),
      handler({ content }) {
        const issues: Array<{ type: "error" | "warning" | "info"; message: string; path?: string }> = [];
        try {
          const spec = JSON.parse(content);
          if (!spec.openapi) issues.push({ type: "error", message: "Missing required field 'openapi'", path: "openapi" });
          if (!spec.info) issues.push({ type: "error", message: "Missing required field 'info'", path: "info" });
          else {
            if (!spec.info.title) issues.push({ type: "error", message: "Missing info.title", path: "info.title" });
            if (!spec.info.version) issues.push({ type: "error", message: "Missing info.version", path: "info.version" });
          }
          if (!spec.paths) issues.push({ type: "error", message: "Missing required field 'paths'", path: "paths" });
        } catch {
          issues.push({ type: "warning", message: "Content is not valid JSON — may be YAML or empty" });
        }
        return { issues };
      },
    }),
  ],
  output: s.object({
    valid: s.boolean,
    issues: s.array(s.object({
      type: s.enum("error", "warning", "info"),
      message: s.string,
      path: s.optional(s.string),
    })),
    issueCount: s.int,
  }),
});

export default openapiSpecValidator;
```
