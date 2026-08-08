# 373 - Toml Config Section Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const analyzeTomlFile = defineTool("analyzeTomlFile", {
  description: "Read a TOML file and extract its top-level section headers and key count.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8");
    const sections = [...content.matchAll(/^\[(\w+)\]/gm)].map((m: RegExpMatchArray) => m[1]);
    const keyCount = content.split("\n").filter((l: string) => /^\w+\s*=/.test(l)).length;
    const hasRequired = sections.includes("dependencies") || sections.includes("package");
    return { sections, keyCount, hasRequired };
  },
});

// Agent role: Discover all TOML files and analyze their section structure.
const tomlConfigAnalyzer = agent({
  model: "small",
  instructions: p`Analyze TOML files found at ${p.glob("**/*.toml")} using the analyzeTomlFile tool. Return results keyed by file path.`,
  output: s.record(s.object({ sections: s.array(s.string), keyCount: s.int, hasRequired: s.boolean })),
  tools: [analyzeTomlFile],
  addons: [repair()],
});

export default tomlConfigAnalyzer;
```
