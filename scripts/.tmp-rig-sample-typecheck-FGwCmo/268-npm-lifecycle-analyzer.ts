import { agent, p, s, defineTool } from "rig";

const classifyScript = defineTool("classifyScript", {
  description: "Classify an npm script by name into a lifecycle category.",
  parameters: s.object({ scriptName: s.string, command: s.string }),
  handler({ scriptName }) {
    const name = scriptName.toLowerCase();
    const isHook = /^(pre|post)/.test(name);
    if (/build|compile|bundle|webpack|rollup|esbuild/.test(name)) return { category: "build", isHook };
    if (/test|jest|vitest|mocha|spec/.test(name)) return { category: "test", isHook };
    if (/lint|eslint|tslint|prettier|format/.test(name)) return { category: "lint", isHook };
    if (/release|publish|deploy|version|changelog/.test(name)) return { category: "release", isHook };
    if (isHook) return { category: "hook", isHook: true };
    return { category: "other", isHook: false };
  },
});

// Agent role: analyze npm lifecycle scripts in package.json and classify each one.
const npmLifecycleAnalyzer = agent({
  model: "typecheck",
  instructions: p`Analyze the npm lifecycle scripts defined in package.json.

package.json contents:
${p.read("package.json")}

For each entry in the "scripts" field, call classifyScript with the script name and command.
Build a scripts record keyed by script name with command, category, and isHook.
Count hookCount (scripts where isHook is true).
List missingRecommended: which of ["test", "build", "lint"] are absent from scripts.
Set hasTestScript and hasBuildScript based on whether those categories exist.`,
  tools: [classifyScript],
  output: s.object({
    scripts: s.record(
      s.object({
        command: s.string,
        category: s.enum("build", "test", "lint", "release", "hook", "other"),
        isHook: s.boolean,
      })
    ),
    hookCount: s.int,
    missingRecommended: s.array(s.string),
    hasTestScript: s.boolean,
    hasBuildScript: s.boolean,
  }),
});

export default npmLifecycleAnalyzer;
