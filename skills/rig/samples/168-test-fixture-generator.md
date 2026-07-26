# 168 - Test Fixture Generator

```rig
import { agent, p, s } from "rig";

// Agent role: analyze a TypeScript function's signature and generate a test fixture file.
const signatureAnalyzer = agent({
  name: "signatureAnalyzer",
  model: "nano",
  input: s.object({ content: s.string, functionName: s.string }),
  instructions: p`Analyze the TypeScript source and identify the signature for the requested function. Return parameter types, return type, and any needed imports.`,
  output: s.object({
    params: s.array(s.object({ name: s.string, type: s.string })),
    returnType: s.string,
    requiredImports: s.array(s.string),
  }),
});

// Agent role: generate a test fixture file for a specific TypeScript function.
const testFixtureGenerator = agent({
  model: "small",
  agents: { signatureAnalyzer },
  input: s.object({
    sourceFile: s.path,
    functionName: s.string,
  }),
  instructions: p`Generate a test fixture file for a TypeScript function.

Source file contents:
${p.readInput("sourceFile")}

Delegate to the signatureAnalyzer subagent to extract the function signature for the requested functionName. Then generate complete test fixture code including sample inputs, expected outputs, and a describe/it test scaffold. Write the fixture file.

${p.writeOutput("suggestedFileName", "fixture-output.ts")}

Return only the declared output.`,
  output: s.object({
    fixtureCode: s.string,
    imports: s.array(s.string),
    suggestedFileName: s.path,
  }),
});

export default testFixtureGenerator;
```
