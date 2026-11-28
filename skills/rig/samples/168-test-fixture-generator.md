# 168 - Test Fixture Generator

```rig
import { agent, p, s } from "rig";

// Agent role: analyze a TypeScript function's signature and generate a test fixture file.
const signatureAnalyzer = agent({
  name: "signatureAnalyzer",
  model: "small",
  input: s.object({ content: s.string, functionName: s.string }),
  instructions: p`Analyze the TypeScript source and identify the signature for the requested function. Return parameter types, return type, and any needed imports.`,
  output: s.object({ params: s.array(s.object({ name: s.string, type: s.string })), returnType: s.string, requiredImports: s.array(s.string) }),
});
// Agent role: generate a test fixture file for a specific TypeScript function.
const testFixtureGenerator = agent({
  model: "small",
  agents: { signatureAnalyzer },
  instructions: p`Generate a test fixture file for a TypeScript function.

Source file contents: ${p.read("scripts/sample-themes.ts")}

Delegate to signatureAnalyzer with the source file contents as content and "seedThemes" as functionName. Then generate complete test fixture code including sample inputs, expected outputs, and a describe/it test scaffold.

${p.writeOutput("fixtureCode", "fixture-output.ts")}

Set suggestedFileName to "fixture-output.ts" and return only the declared output.`,
  output: s.object({ fixtureCode: s.string, imports: s.array(s.string), suggestedFileName: s.path }),
});

export default testFixtureGenerator;
```
