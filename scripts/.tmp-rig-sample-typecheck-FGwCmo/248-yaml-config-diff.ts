import { agent, p, s, defineTool } from "rig";

const extractYamlKeys = defineTool("extractYamlKeys", {
  description: "Extract top-level keys from a YAML string.",
  parameters: { content: s.string },
  handler: ({ content }: { content: string }) => {
    const keys: string[] = [];
    for (const line of content.split("\n")) {
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):/);
      if (m) keys.push(m[1]);
    }
    return keys;
  },
});

const diffKeys = defineTool("diffKeys", {
  description: "Compute added and removed keys between two key arrays.",
  parameters: { baseKeys: s.array(s.string), targetKeys: s.array(s.string) },
  handler: ({ baseKeys, targetKeys }: { baseKeys: string[]; targetKeys: string[] }) => {
    const addedKeys = targetKeys.filter((k: string) => !baseKeys.includes(k));
    const removedKeys = baseKeys.filter((k: string) => !targetKeys.includes(k));
    return { addedKeys, removedKeys };
  },
});

// Agent role: diff top-level keys between two YAML config files and detect breaking changes.
const yamlConfigDiff = agent({
  model: "typecheck",
  input: s.object({ baseFile: s.string, targetFile: s.string }),
  instructions: p`Diff top-level YAML keys between two config files.

Base file content: ${p.readInput("baseFile")}
Target file content: ${p.readInput("targetFile")}

Steps:
1. Call extractYamlKeys on the base file content to get baseKeys.
2. Call extractYamlKeys on the target file content to get targetKeys.
3. Call diffKeys with baseKeys and targetKeys to get addedKeys and removedKeys.
4. changedKeys are keys present in both where values differ (estimate from context if possible, else leave empty).
5. totalChanges = addedKeys.length + removedKeys.length + changedKeys.length.
6. hasBreakingChanges = removedKeys.length > 0.`,
  output: s.object({
    addedKeys: s.array(s.string),
    removedKeys: s.array(s.string),
    changedKeys: s.array(s.string),
    totalChanges: s.number,
    hasBreakingChanges: s.boolean,
  }),
  tools: [extractYamlKeys, diffKeys],
  maxTurns: 6,
});

export default yamlConfigDiff;
