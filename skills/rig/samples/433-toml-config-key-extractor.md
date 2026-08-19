# 433 - TOML Config Key Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseTomlSection = defineTool("parseTomlSection", {
  description: "Extract section headers and key=value pairs from TOML content.",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "__default__";
    let hasDefaultSection = false;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = sections[currentSection] ?? {};
      } else {
        const kvMatch = trimmed.match(/^([^=\s][^=]*?)\s*=\s*(.*)$/);
        if (kvMatch) {
          if (currentSection === "__default__") hasDefaultSection = true;
          sections[currentSection] = sections[currentSection] ?? {};
          sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
        }
      }
    }
    return { sections, hasDefaultSection };
  },
});

// Agent role: Extract all TOML sections and key-value pairs from a config file.
const tomlKeyExtractor = agent({
  model: "small",
  input: s.object({ configFile: s.path }),
  instructions: p`Read the TOML config file: ${p.readInput("configFile")}. Use parseTomlSection to extract all sections and their key=value pairs. Return the complete structure.`,
  output: s.object({
    sections: s.record(s.record(s.string)),
    totalKeys: s.int,
    totalSections: s.int,
    hasDefaultSection: s.boolean,
  }),
  tools: [parseTomlSection],
  addons: [repair()],
});

export default tomlKeyExtractor;
```
