# 377 - YAML Key Presence Validator

```rig
import { agent, defineTool, p, s, repair } from "rig";

const checkYamlKey = defineTool("checkYamlKey", {
  description: "Check whether a dot-notation key path exists in YAML content",
  parameters: s.object({
    content: s.string("YAML file content"),
    keyPath: s.string("dot-notation key path like 'server.port'"),
  }),
  handler({ content, keyPath }) {
    const parts = keyPath.split(".");
    let present = false;
    // Check if all parts of the key path appear in order as indented keys
    let remaining = content;
    for (const part of parts) {
      const pattern = new RegExp(`(?:^|\\n)\\s*${part}\\s*:`, "m");
      if (pattern.test(remaining)) {
        const idx = remaining.search(pattern);
        remaining = remaining.slice(idx);
        present = true;
      } else {
        present = false;
        break;
      }
    }
    return present ? "present" : "missing";
  },
});

// Agent role: validate that required keys are present in a YAML configuration file.
const yamlKeyValidator = agent({
  model: "small",
  input: s.object({
    yamlFile: s.path,
    requiredKeys: s.array(s.string),
  }),
  instructions: p`Validate a YAML file for required key presence.

YAML file content:
${p.readInput("yamlFile")}

Required keys to check: use the input.requiredKeys array.

For each required key, call checkYamlKey with the full file content and the key path. Collect which keys are present and which are missing.

Return the output schema with missingKeys, presentKeys, allPresent, and checkedKeys.`,
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
