# ts-interface-stub-writer - TypeScript Interface Stub Writer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const validateMethodSignature = defineTool("validateMethodSignature", {
  description: "Validate a TypeScript method signature string.",
  parameters: s.object({
    signature: s.string,
  }),
  handler: async ({ signature }) => {
    const valid = /^\s*\w+\s*\([^)]*\)\s*:\s*\S+\s*$/.test(signature);
    return {
      valid,
      reason: valid ? undefined : `"${signature}" is not a valid TypeScript method signature (expected: name(args): ReturnType)`,
    };
  },
});

// Agent role: generate a TypeScript interface stub file from a name and method list.
const tsInterfaceStubWriter = agent({
  model: "small",
  input: s.object({
    interfaceName: s.string,
    methods: s.array(s.string),
    outputFile: s.path,
  }),
  output: s.object({
    outputFile: s.path,
    methodsWritten: s.array(s.string),
    isValid: s.boolean,
    linesEmitted: s.int,
  }),
  instructions: p`For each method signature in input.methods, call validateMethodSignature to check it is valid. Collect only the valid method signatures. Write a TypeScript interface file to ${p.writeOutput("outputFile", "outputFile")} with the format:\n\nexport interface InterfaceName {\n  method1(args): ReturnType;\n  ...\n}\n\nReturn outputFile, methodsWritten (the valid signatures included), isValid (true if all input methods were valid), and linesEmitted (total lines written).`,
  tools: [validateMethodSignature],
  addons: [repair()],
});

export default tsInterfaceStubWriter;
```
