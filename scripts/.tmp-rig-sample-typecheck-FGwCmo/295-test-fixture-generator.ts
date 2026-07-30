import { agent, p, s } from "rig";

// Agent role: extract function signature from a TypeScript source file
const signatureAnalyzer = agent({
  name: "signatureAnalyzer",
  model: "typecheck",
  instructions: p`Given the TypeScript source in the input, extract the signature for the function named in functionName. Return the parameter types, return type, and any imports needed to use this function in a test.`,
  input: s.object({ source: s.string, functionName: s.string }),
  output: s.object({
    params: s.array(s.object({ name: s.string, type: s.string })),
    returnType: s.string,
    imports: s.array(s.string),
  }),
});

// Agent role: generate test fixtures for a TypeScript function
const testFixtureGenerator = agent({
  model: "typecheck",
  instructions: p`Generate a test fixture for the function specified in the input.

Read the source file: ${p.readInput("sourceFile")}

Delegate signature extraction to the signatureAnalyzer subagent for the function named in the input's functionName field. Then generate a complete test fixture file with sample inputs, expected outputs, and required imports. Write the fixture to the path in suggestedFileName.`,
  input: s.object({ sourceFile: s.path, functionName: s.string }),
  output: s.object({
    fixtureCode: s.string,
    imports: s.array(s.string),
    suggestedFileName: s.path,
  }),
  agents: { signatureAnalyzer },
});

export default testFixtureGenerator;
