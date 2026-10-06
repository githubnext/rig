# 503 - INI Config Parser

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseIniSection = defineTool("parseIniSection", {
  description: "Parse an INI config file into sections and key-value pairs",
  parameters: s.object({ content: s.string }),
  handler: ({ content }: { content: string }) => {
    const sections: Record<string, Record<string, string>> = {};
    let current = "__default__";
    sections[current] = {};
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(";") || line.startsWith("#")) continue;
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        current = sectionMatch[1];
        sections[current] = {};
        continue;
      }
      const kvMatch = line.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        sections[current][kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }
    return sections;
  },
});

// Agent role: Parse a caller-supplied INI config file and return structured sections and key counts.
const iniConfigParser = agent({
  model: "small",
  input: s.object({ configFile: s.string }),
  instructions: p`Parse the INI config file at the path provided in input.configFile: ${p.readInput("configFile")}.
Call parseIniSection with the file contents.
Return the declared output.`,
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
