# 417 - Ini Config Parser

```rig
import { agent, defineTool, p, repair, s } from "rig";

const parseIniSection = defineTool("parseIniSection", {
  description: "Parse an INI file content and return sections with key-value pairs.",
  parameters: s.object({ content: s.string }),
  handler({ content }: { content: string }) {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "__default__";
    sections[currentSection] = {};
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";") || line.startsWith("#")) continue;
      const sectionMatch = /^\[(.+)\]$/.exec(line);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = {};
        continue;
      }
      const kvMatch = /^([^=]+)=(.*)$/.exec(line);
      if (kvMatch) {
        sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }
    return sections;
  },
});

// Agent role: parse an INI config file and report its sections and key-value pairs.
const iniConfigParser = agent({
  model: "small",
  input: s.object({ configFile: s.string }),
  instructions: p`Parse the INI config file at the path provided in configFile.

Content:
${p.readInput("configFile")}

Call parseIniSection with the full file content. Build the sections record. totalSections = number of sections (excluding __default__ if empty). totalKeys = total key-value pairs across all sections. hasDefaultSection = true if there are keys outside any named section.`,
  output: s.object({
    sections: s.record(s.record(s.string)),
    totalKeys: s.number,
    totalSections: s.number,
    hasDefaultSection: s.boolean,
  }),
  tools: [parseIniSection],
  addons: [repair()],
});

export default iniConfigParser;
```
