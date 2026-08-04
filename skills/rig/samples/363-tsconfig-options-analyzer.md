# 363 - Tsconfig Options Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseTsConfigOption = defineTool("parseTsConfigOption", {
  description: "Classify a TypeScript compiler option into a category.",
  parameters: { key: s.string, value: s.unknown },
  handler: ({ key }: { key: string; value: unknown }) => {
    const strict = ["strict", "strictNullChecks", "strictFunctionTypes", "strictBindCallApply", "strictPropertyInitialization", "noImplicitAny", "noImplicitThis", "alwaysStrict"];
    const perf = ["skipLibCheck", "skipDefaultLibCheck", "incremental", "tsBuildInfoFile"];
    const output = ["outDir", "outFile", "declaration", "declarationDir", "declarationMap", "sourceMap", "removeComments", "noEmit", "emitDeclarationOnly"];
    const paths = ["baseUrl", "paths", "rootDir", "rootDirs", "typeRoots", "types"];
    if (strict.includes(key)) return { category: "strict" as const, recommended: true };
    if (perf.includes(key)) return { category: "perf" as const, recommended: false };
    if (output.includes(key)) return { category: "output" as const, recommended: false };
    if (paths.includes(key)) return { category: "paths" as const, recommended: false };
    return { category: "misc" as const, recommended: false };
  },
});

const tsconfigOptionsAnalyzer = agent({
  model: "small",
  instructions: p`Analyze TypeScript compiler options across tsconfig files.

Main tsconfig.json:
${p.read("tsconfig.json")}

Variant tsconfig files found:
${p.bash("ls tsconfig.*.json 2>/dev/null || echo 'none'")}

Steps:
1. Parse compilerOptions from the main tsconfig.json.
2. For each compiler option key/value, call parseTsConfigOption to get category and recommended.
3. Build an options record keyed by option name with value, category, recommended.
4. strictCount = number of options with category "strict".
5. hasIsolatedModules = true if "isolatedModules" option is present and set to true.
6. configFilesFound = list of tsconfig files found (include tsconfig.json and any variants).`,
  output: s.object({
    options: s.record(
      s.object({
        value: s.unknown,
        category: s.enum("strict", "perf", "output", "paths", "misc"),
        recommended: s.boolean,
      })
    ),
    strictCount: s.number,
    hasIsolatedModules: s.boolean,
    configFilesFound: s.array(s.string),
  }),
  tools: [parseTsConfigOption],
  addons: [repair()],
});

export default tsconfigOptionsAnalyzer;
```
