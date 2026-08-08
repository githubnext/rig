# 377 - Ts Barrel Module Writer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const validateExportName = defineTool("validateExportName", {
  description: "Validate that a string is a valid JavaScript identifier for export.",
  parameters: s.object({ name: s.string }),
  handler({ name }) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  },
});

// Agent role: Generate a TypeScript barrel module that re-exports the given symbols and write it to the target file.
const tsBarrelModuleWriter = agent({
  model: "small",
  input: s.object({ targetFile: s.path, moduleName: s.string, exports: s.array(s.string) }),
  instructions: p`Given the input targetFile, moduleName, and exports array, validate each export name using validateExportName, generate barrel export lines, and write the module to ${p.writeInput("targetFile", "moduleContent")}.`,
  output: s.object({
    outputFile: s.path,
    exportsWritten: s.array(s.string),
    moduleLines: s.int,
    success: s.boolean,
  }),
  tools: [validateExportName],
  addons: [repair()],
});

export default tsBarrelModuleWriter;
```
