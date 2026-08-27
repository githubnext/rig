# 477 - Node Module Path Resolver

```rig
import { agent, defineTool, p, repair, s } from "rig";

const resolveModulePath = defineTool("resolveModulePath", {
  description: "Resolve the filesystem path of an installed npm package using node:module.",
  parameters: s.object({ moduleName: s.string }),
  handler: async ({ moduleName }) => {
    const { createRequire } = await import("node:module");
    const { isBuiltin } = await import("node:module");
    if (isBuiltin(moduleName)) {
      return { resolvedPath: null, isBuiltin: true };
    }
    try {
      const req = createRequire(process.cwd() + "/index.js");
      const resolved = req.resolve(moduleName);
      return { resolvedPath: resolved, isBuiltin: false };
    } catch {
      return { resolvedPath: null, isBuiltin: false };
    }
  },
});

// Agent role: resolve an npm module path and extract its package.json metadata.
const nodeModulePathResolver = agent({
  model: "small",
  input: s.object({ moduleName: s.string }),
  instructions: p`The module to resolve is provided in input.moduleName. Call resolveModulePath with it. If resolvedPath is returned, find and read the package.json near that path: ${p.readOptional("package.json", "{}")}. Extract name, version, main, and types fields. Return resolvedPath, packageName, version, main, types, and isBuiltin.`,
  output: s.object({
    resolvedPath: s.string,
    packageName: s.string,
    version: s.string,
    main: s.optional(s.string),
    types: s.optional(s.string),
    isBuiltin: s.boolean,
  }),
  tools: [resolveModulePath],
  maxTurns: 4,
  addons: repair(),
});

export default nodeModulePathResolver;
```
