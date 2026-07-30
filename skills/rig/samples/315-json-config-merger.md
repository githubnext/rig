# 315 - Json Config Merger

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: deeply merge two JSON config files and write the result to an output path.
const jsonConfigMerger = agent({
  model: "small",
  input: s.object({
    baseConfig: s.path,
    overrideConfig: s.path,
    outputPath: s.path,
  }),
  instructions: p`You are a JSON config merger.

Base config contents:
${p.readInput("baseConfig")}

Override config contents:
${p.readInput("overrideConfig")}

Use the mergeJsonObjects tool to deeply merge the override config into the base config.
Then write the merged result to ${p.writeInput("outputPath", "mergedContent")}.
Return the declared output.`,
  tools: [
    defineTool("mergeJsonObjects", {
      description: "Deep merge two JSON strings, returning the merged JSON and counts of added/overridden keys",
      parameters: s.object({
        baseJson: s.string,
        overrideJson: s.string,
      }),
      handler({ baseJson, overrideJson }) {
        const base = JSON.parse(baseJson) as Record<string, unknown>;
        const override = JSON.parse(overrideJson) as Record<string, unknown>;
        let keysAdded = 0;
        let keysOverridden = 0;
        function deepMerge(
          target: Record<string, unknown>,
          source: Record<string, unknown>
        ): Record<string, unknown> {
          const result = { ...target };
          for (const [key, value] of Object.entries(source)) {
            if (key in result) {
              if (
                typeof result[key] === "object" &&
                result[key] !== null &&
                typeof value === "object" &&
                value !== null
              ) {
                result[key] = deepMerge(
                  result[key] as Record<string, unknown>,
                  value as Record<string, unknown>
                );
              } else {
                result[key] = value;
                keysOverridden++;
              }
            } else {
              result[key] = value;
              keysAdded++;
            }
          }
          return result;
        }
        const merged = deepMerge(base, override);
        return {
          mergedJson: JSON.stringify(merged, null, 2),
          keysAdded,
          keysOverridden,
          totalKeys: Object.keys(merged).length,
        };
      },
    }),
  ],
  output: s.object({
    keysAdded: s.int,
    keysOverridden: s.int,
    totalKeys: s.int,
    outputPath: s.path,
  }),
  addons: [repair()],
});

export default jsonConfigMerger;
```
