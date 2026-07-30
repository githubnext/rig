import { agent, defineTool, p, s, repair } from "rig";

const analyzeTomlFile = defineTool("analyzeTomlFile", {
  description: "Read a TOML file and extract its top-level section headers and key count.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const sections = [...content.matchAll(/^\[([^\]]+)\]/gm)].map((m: RegExpMatchArray) => m[1] as string);
      const keyCount = (content.match(/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=/gm) ?? []).length;
      const hasRequired = sections.includes("package") || sections.includes("tool") || keyCount > 0;
      return { sections, keyCount, hasRequired };
    } catch {
      return { sections: [], keyCount: 0, hasRequired: false };
    }
  },
});

// Agent role: analyze all TOML config files in the workspace and summarize their sections.
const tomlConfigAnalyzer = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Analyze all TOML config files found in the workspace.

TOML files found:
${p.glob("**/*.toml")}

For each file path listed above, call analyzeTomlFile to extract its sections, keyCount, and hasRequired flag. Return a record keyed by file path.`,
  tools: [analyzeTomlFile],
  output: s.record(
    s.object({
      sections: s.array(s.string),
      keyCount: s.int,
      hasRequired: s.boolean,
    })
  ),
});

export default tomlConfigAnalyzer;
