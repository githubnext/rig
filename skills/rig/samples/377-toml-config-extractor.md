# 377 - TOML Config Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseTomlSection = defineTool("parseTomlSection", {
  description: "Parse TOML content and return sections with key-value pairs.",
  parameters: { content: s.string },
  handler: ({ content }: { content: string }) => {
    const lines = content.split("\n");
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "__default__";
    let hasDefaultSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = sections[currentSection] ?? {};
        continue;
      }
      const kvMatch = trimmed.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (kvMatch) {
        if (currentSection === "__default__") {
          sections[currentSection] = sections[currentSection] ?? {};
          hasDefaultSection = true;
        }
        sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    const totalSections = Object.keys(sections).filter((k) => k !== "__default__").length;
    const totalKeys = Object.values(sections).reduce((sum, s) => sum + Object.keys(s).length, 0);
    const result: Record<string, Record<string, string>> = {};
    for (const [sec, kvs] of Object.entries(sections)) {
      if (sec !== "__default__" || Object.keys(kvs).length > 0) result[sec] = kvs;
    }
    return { sections: result, totalKeys, totalSections, hasDefaultSection };
  },
});

// Agent role: extract all sections and key-value pairs from a TOML config file.
const tomlConfigExtractor = agent({
  model: "small",
  input: s.object({ configFile: s.path }),
  instructions: p`Extract sections and key-value pairs from a TOML config file.

File contents:
${p.readInput("configFile")}

Steps:
1. Call parseTomlSection with the full file content to get sections, totalKeys, totalSections, hasDefaultSection.
2. Return the result directly.`,
  output: s.object({
    sections: s.record(s.record(s.string)),
    totalKeys: s.int,
    totalSections: s.int,
    hasDefaultSection: s.boolean,
  }),
  tools: [parseTomlSection],
  addons: [repair()],
});

export default tomlConfigExtractor;
```
