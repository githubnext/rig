# 285 - Test Fixture Generator

```rig
import { agent, p, s } from "rig";

// Agent role: analyze a function signature and return its parameters and return type.
const signatureAnalyzer = agent({
  model: "small",
  instructions: p`Analyze the TypeScript source provided in the input. Extract the signature details for the specified function: its parameters (name and type), return type, and any JSDoc description. Return structured signature details.`,
  input: s.object({ sourceFile: s.path, functionName: s.string }),
  output: s.object({
    functionName: s.string,
    parameters: s.array(s.object({ name: s.string, type: s.string })),
    returnType: s.string,
    description: s.optional(s.string),
  }),
});

// Agent role: generate a test fixture for a specific function in a TypeScript source file.
const testFixtureGenerator = agent({
  model: "small",
  input: s.object({ sourceFile: s.path, functionName: s.string }),
  instructions: p`Generate a test fixture file for the specified function.

Source file content:
${p.readInput("sourceFile")}

1. Delegate to signatureAnalyzer to get the function signature for the function named in the input.
2. Using the signature, generate fixture code: example inputs, mock helpers, and a vitest describe block.
3. Write the fixture code to fixture.ts: ${p.writeOutput("fixtureCode", "fixture.ts")}
4. Return fixtureCode (the full fixture source), the required imports, and suggestedFileName.`,
  output: s.object({
    fixtureCode: s.string,
    imports: s.array(s.string),
    suggestedFileName: s.path,
  }),
  agents: { signatureAnalyzer },
});

export default testFixtureGenerator;
```
