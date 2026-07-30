import { agent, p, s, defineTool, repair } from "rig";

const parseTsConfigOption = defineTool("parseTsConfigOption", {
  description: "Classify a tsconfig compilerOption by name and infer if it is recommended.",
  parameters: s.object({ optionName: s.string }),
  handler({ optionName }) {
    const strictOptions = new Set(["strict", "noImplicitAny", "strictNullChecks", "strictFunctionTypes", "strictBindCallApply", "strictPropertyInitialization", "noImplicitThis", "alwaysStrict", "useUnknownInCatchVariables", "exactOptionalPropertyTypes", "noUncheckedIndexedAccess"]);
    const perfOptions = new Set(["incremental", "composite", "tsBuildInfoFile", "isolatedModules", "skipLibCheck", "skipDefaultLibCheck"]);
    const outputOptions = new Set(["outDir", "outFile", "rootDir", "declarationDir", "declaration", "declarationMap", "sourceMap", "inlineSources", "inlineSourceMap", "emitDeclarationOnly", "noEmit"]);
    const pathOptions = new Set(["paths", "baseUrl", "rootDirs", "typeRoots", "types"]);
    if (strictOptions.has(optionName)) return { category: "strict", recommended: true };
    if (perfOptions.has(optionName)) return { category: "perf", recommended: true };
    if (outputOptions.has(optionName)) return { category: "output", recommended: false };
    if (pathOptions.has(optionName)) return { category: "paths", recommended: false };
    return { category: "misc", recommended: false };
  },
});

// Agent role: analyze tsconfig.json compiler options and classify each one.
const tsconfigOptionAnalyzer = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Analyze TypeScript compiler options from tsconfig files in this project.

Main tsconfig.json:
${p.read("tsconfig.json")}

Additional tsconfig files found:
${p.glob("tsconfig.*.json")}

For each compilerOption key found in the tsconfig files, call parseTsConfigOption to get
its category and recommended status.
Build an options record keyed by option name with value (from config), category, and recommended.
Count strictCount (number of strict-category options enabled).
Set hasIsolatedModules to true if isolatedModules is set to true.
List all config file paths found in configFilesFound.`,
  tools: [parseTsConfigOption],
  output: s.object({
    options: s.record(
      s.object({
        value: s.unknown,
        category: s.enum("strict", "perf", "output", "paths", "misc"),
        recommended: s.boolean,
      })
    ),
    strictCount: s.int,
    hasIsolatedModules: s.boolean,
    configFilesFound: s.array(s.string),
  }),
});

export default tsconfigOptionAnalyzer;
