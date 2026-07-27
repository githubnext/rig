# 192 - Json Schema Migration Planner

```rig
import { agent, p, s } from "rig";

// Agent role: analyze structural differences between two JSON schemas and list each change.
const diffAnalyzer = agent({
  name: "diffAnalyzer",
  model: "nano",
  instructions: p`Analyze the structural differences between the two JSON schemas provided in the input and list each change with its path and whether it is a breaking change.`,
  input: s.object({ oldSchema: s.string, newSchema: s.string }),
  output: s.array(s.object({
    changeType: s.enum("add", "remove", "modify", "rename"),
    path: s.string,
    description: s.string,
    breakingChange: s.boolean,
  })),
});

// Agent role: read two JSON schema files and produce a migration plan using the diffAnalyzer subagent.
const jsonSchemaMigrationPlanner = agent({
  model: "small",
  input: s.object({ oldSchemaPath: s.path, newSchemaPath: s.path }),
  instructions: p`Read the old schema at ${p.readInput("oldSchemaPath")} and the new schema at ${p.readInput("newSchemaPath")}. Delegate the structural diff analysis to the diffAnalyzer subagent.`,
  output: s.array(s.object({
    changeType: s.enum("add", "remove", "modify", "rename"),
    path: s.string,
    description: s.string,
    breakingChange: s.boolean,
  })),
  agents: { diffAnalyzer },
});

export default jsonSchemaMigrationPlanner;
```
