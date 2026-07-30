import { agent, defineTool, p, s, repair } from "rig";
import { readFile } from "node:fs/promises";

const readJsonFile = defineTool("readJsonFile", {
  description: "Read and parse a JSON file from the given path",
  parameters: s.object({ path: s.string }),
  async handler({ path }) {
    const text = await readFile(path, "utf8");
    return JSON.parse(text);
  },
});

const mergeObjects = defineTool("mergeObjects", {
  description: "Shallow-merge an override object into a base object",
  parameters: s.object({ base: s.unknown, override: s.unknown }),
  handler({ base, override }) {
    const b = base as Record<string, unknown>;
    const o = override as Record<string, unknown>;
    let keysAdded = 0;
    let keysOverridden = 0;
    const result = { ...b };
    for (const [k, v] of Object.entries(o)) {
      if (k in result) keysOverridden++;
      else keysAdded++;
      result[k] = v;
    }
    return { merged: JSON.stringify(result, null, 2), keysAdded, keysOverridden, totalKeys: Object.keys(result).length };
  },
});

// Agent role: merge two JSON config files and write the combined result to an output path.
const jsonConfigMerger = agent({
  model: "typecheck",
  input: s.object({
    baseConfig: s.path,
    overrideConfig: s.path,
    outputPath: s.path,
  }),
  instructions: p`You are a JSON config merger.

Base config file contents:
${p.readInput("baseConfig")}

Use the readJsonFile tool to read the override config at input.overrideConfig.
Use the mergeObjects tool to merge the override into the base.
The merged field from the tool result is already a JSON string — use it as the output "merged" value.
${p.writeInput("outputPath", "merged")}`,
  tools: [readJsonFile, mergeObjects],
  addons: [repair()],
  output: s.object({
    merged: s.string,
    keysAdded: s.int,
    keysOverridden: s.int,
    totalKeys: s.int,
  }),
});

export default jsonConfigMerger;
