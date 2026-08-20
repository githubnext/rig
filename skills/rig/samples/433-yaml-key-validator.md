# 433 - YAML Key Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkYamlKey = defineTool("checkYamlKey", {
  description: "Check if a dot-notation key path is present in YAML content",
  parameters: s.object({ content: s.string, keyPath: s.string }),
  handler: async ({ content, keyPath }) => {
    const parts = keyPath.split(".");
    const topKey = parts[0];
    const pattern = new RegExp(`^${topKey}\\s*:`, "m");
    const present = pattern.test(content);
    return { present };
  },
});

// Agent role: Validate that all required keys are present in a YAML config file.
const yamlKeyValidator = agent({
  name: "yaml-key-validator",
  model: "small",
  maxTurns: 5,
  input: s.object({ yamlFile: s.path, requiredKeys: s.array(s.string) }),
  instructions: p`You are a YAML key validator. Here is the content of the YAML file:
${p.readInput("yamlFile")}

For each key in the input requiredKeys, call checkYamlKey with the content and the key path.
Then return missingKeys (keys not found), presentKeys (keys found), allPresent, and checkedKeys count.`,
  output: s.object({
    missingKeys: s.array(s.string),
    presentKeys: s.array(s.string),
    allPresent: s.boolean,
    checkedKeys: s.int,
  }),
  tools: [checkYamlKey],
  addons: [repair()],
});

export default yamlKeyValidator;
```
