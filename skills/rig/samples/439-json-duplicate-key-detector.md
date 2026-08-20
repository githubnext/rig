# 439 - JSON Duplicate Key Detector

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseJsonKeys = defineTool("parseJsonKeys", {
  description: "Detect duplicate keys in a JSON file by scanning raw text",
  parameters: s.object({ content: s.string }),
  handler: async ({ content }) => {
    const keyPattern = /"([^"]+)"\s*:/g;
    const keyCounts: Record<string, number> = {};
    let m: RegExpExecArray | null;
    while ((m = keyPattern.exec(content)) !== null) {
      const key = m[1];
      keyCounts[key] = (keyCounts[key] ?? 0) + 1;
    }
    const duplicates = Object.entries(keyCounts)
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));
    return { duplicates, totalKeys: Object.keys(keyCounts).length };
  },
});

// Agent role: Detect duplicate keys in a JSON config file and report findings.
const jsonDuplicateKeyDetector = agent({
  name: "json-duplicate-key-detector",
  model: "small",
  maxTurns: 4,
  input: s.object({ configFile: s.path }),
  instructions: p`You are a JSON duplicate key detector. Here is the content of the config file:
${p.readInput("configFile")}

Call parseJsonKeys with the full file content. Then return duplicates (array of key/count objects), hasDuplicates (true if any duplicates exist), and totalKeys.`,
  output: s.object({
    duplicates: s.array(s.object({ key: s.string, count: s.int })),
    hasDuplicates: s.boolean,
    totalKeys: s.int,
  }),
  tools: [parseJsonKeys],
  addons: [repair()],
});

export default jsonDuplicateKeyDetector;
```
