# 84 - Json Schema Migration

```rig
import { agent, p, s } from "rig";

// Agent role: analyze two JSON schema files to identify structural changes and produce a migration plan.
const diffAnalyzer = agent({
  name: "diffAnalyzer",
  model: "nano",
  instructions: p`Analyze the structural differences between the two JSON schemas provided in the input and list each change type (add, remove, modify, rename) with the JSON path and whether it is a breaking change.`,
  input: s.object({ oldSchema: s.string, newSchema: s.string }),
  output: s.array(s.object({
    changeType: s.enum("add", "remove", "modify", "rename"),
    path: s.string,
    description: s.string,
    breakingChange: s.boolean,
  })),
});

// Agent role: read two JSON schema files and coordinate a migration plan using the diffAnalyzer subagent.
const jsonSchemaMigration = agent({
  model: "small",
  input: s.object({ oldSchemaPath: s.path, newSchemaPath: s.path }),
  instructions: p`Read the old schema at ${p.readInput("oldSchemaPath")} and new schema at ${p.readInput("newSchemaPath")}. Pass both to the diffAnalyzer subagent to identify all changes and whether each is a breaking change.`,
  output: s.array(s.object({
    changeType: s.enum("add", "remove", "modify", "rename"),
    path: s.string,
    description: s.string,
    breakingChange: s.boolean,
  })),
  agents: { diffAnalyzer },
});

export default jsonSchemaMigration;
```
