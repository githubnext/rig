# 497 - Ts Default Param Extractor

```rig
import { agent, defineTool, p, s, repair } from "rig";

const extractDefaultParam = defineTool("extractDefaultParam", {
  description: "Extract function name, parameter name, and default value from a TypeScript line",
  parameters: s.object({ file: s.path, line: s.int, raw: s.string }),
  handler({ raw }) {
    const fnMatch = raw.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=)/);
    const paramMatch = raw.match(/(\w+)\s*=\s*([^,)]+)/);
    return {
      functionName: fnMatch?.[1] ?? fnMatch?.[2] ?? "anonymous",
      paramName: paramMatch?.[1] ?? "unknown",
      defaultValue: paramMatch?.[2]?.trim() ?? "unknown",
    };
  },
});

// Agent role: find TypeScript functions with default parameter values and report them.
const tsDefaultParamExtractor = agent({
  model: "small",
  instructions: p`Find TypeScript files with ${p.glob("src/**/*.ts")}. Search for function parameters with defaults using ${p.bash("grep -rn 'function\\|const.*=>' src/ 2>/dev/null | grep '=' | grep -v '=>' | head -50 || true")}. Use extractDefaultParam for each match. Return the full list of default parameters.`,
  output: s.object({
    defaults: s.array(s.object({ functionName: s.string, paramName: s.string, defaultValue: s.string, file: s.path, line: s.int })),
    totalDefaults: s.int,
    filesWithDefaults: s.array(s.path),
  }),
  tools: [extractDefaultParam],
  addons: [repair()],
});

export default tsDefaultParamExtractor;
```
