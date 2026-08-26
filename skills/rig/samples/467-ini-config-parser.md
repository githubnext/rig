# 467 - INI Config Parser

```rig
import { agent, defineTool, p, repair, s } from "rig";


const parseIniSection = defineTool("parseIniSection", {
  description: "Parse key-value pairs from an INI config file section.",
  parameters: s.object({ content: s.string("Full INI file content"), section: s.string("Section name to parse") }),
  handler({ content, section }) {
    const lines = content.split("\n");
    const sectionRe = new RegExp(`^\\[${section}\\]`);
    const result: Record<string, string> = {};
    let inSection = false;
    for (const line of lines) {
      if (sectionRe.test(line.trim())) { inSection = true; continue; }
      if (/^\[/.test(line.trim())) { if (inSection) break; continue; }
      if (!inSection) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx < 0) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key) result[key] = val;
    }
    return JSON.stringify(result);
  },
});

// Agent role: parse an INI configuration file and extract all sections and their key-value pairs.
const iniConfigParser = agent({
  name: "iniConfigParser",
  model: "small",
  input: s.object({ configFile: s.path("Path to the INI config file") }),
  instructions: p`Read the INI configuration file at the specified path.
${p.readInput("configFile")}
Use parseIniSection for each section header you find (lines matching [SectionName]).
Return sections as a record, totalKeys count, and sectionCount.`,
  output: s.object({
    sections: s.record(s.record(s.string)),
    sectionCount: s.int,
    totalKeys: s.int,
  }),
  tools: [parseIniSection],
  addons: [repair()],
});

export default iniConfigParser;
```
