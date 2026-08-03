# 363 - YAML Config Diff V3

```rig
import { agent, p, s, defineTool } from "rig";

const extractTopLevelKeys = defineTool("extractTopLevelKeys", {
  description: "Extract top-level keys from YAML content using regex.",
  parameters: s.object({ yamlContent: s.string }),
  handler: ({ yamlContent }: { yamlContent: string }) => {
    const matches = yamlContent.match(/^(\w[\w-]*):/gm) ?? [];
    const keys = matches.map((m: string) => m.replace(/:$/, ""));
    return { keys };
  },
});

const diffKeys = defineTool("diffKeys", {
  description: "Compute added, removed, and common keys between two arrays.",
  parameters: s.object({ baseKeys: s.array(s.string), targetKeys: s.array(s.string) }),
  handler: ({ baseKeys, targetKeys }: { baseKeys: string[]; targetKeys: string[] }) => {
    const baseSet = new Set(baseKeys);
    const targetSet = new Set(targetKeys);
    const added = targetKeys.filter((k: string) => !baseSet.has(k));
    const removed = baseKeys.filter((k: string) => !targetSet.has(k));
    const common = baseKeys.filter((k: string) => targetSet.has(k));
    return { added, removed, common };
  },
});

// Agent role: compare top-level keys of two YAML config files and report differences.
const yamlConfigDiff = agent({
  model: "small",
  input: s.object({ baseFile: s.string, targetFile: s.string }),
  instructions: p`Compare two YAML config files and report key differences.

Base file (input.baseFile):
${p.readInput("baseFile")}

Target file (input.targetFile):
${p.readInput("targetFile")}

Steps:
1. Call extractTopLevelKeys on each file's content.
2. Call diffKeys with both key arrays.
3. Set totalChanges = added.length + removed.length.
4. Set hasBreakingChanges = removed.length > 0.`,
  output: s.object({
    addedKeys: s.array(s.string),
    removedKeys: s.array(s.string),
    commonKeys: s.array(s.string),
    totalChanges: s.number,
    hasBreakingChanges: s.boolean,
  }),
  tools: [extractTopLevelKeys, diffKeys],
  maxTurns: 4,
  addons: [],
});

export default yamlConfigDiff;
```
