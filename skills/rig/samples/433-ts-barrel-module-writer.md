# ts-barrel-module-writer - TypeScript Barrel Module Writer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const validateExportName = defineTool("validateExportName", {
  description: "Validate that a name is a valid TypeScript identifier for export.",
  parameters: s.object({
    name: s.string,
  }),
  handler: async ({ name }) => {
    const valid = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
    return {
      valid,
      reason: valid ? undefined : `"${name}" is not a valid TypeScript identifier`,
    };
  },
});

// Agent role: write a TypeScript barrel module file exporting named members.
const tsBarrelModuleWriter = agent({
  model: "small",
  input: s.object({
    targetFile: s.path,
    moduleName: s.string,
    exports: s.array(s.string),
  }),
  output: s.object({
    outputFile: s.path,
    exportsWritten: s.array(s.string),
    moduleLines: s.int,
    success: s.boolean,
  }),
  instructions: p`You are writing a TypeScript barrel module. For each name in input.exports, call validateExportName to verify it is a valid identifier. Then write a barrel module to ${p.writeOutput("outputFile", "targetFile")} that re-exports each valid name. The module should contain one export line per valid identifier: \`export { name } from "./name";\`. Return outputFile, exportsWritten (the valid exports written), moduleLines (total lines in the file), and success (true if at least one export was written).`,
  tools: [validateExportName],
  addons: [repair()],
});

export default tsBarrelModuleWriter;
```
