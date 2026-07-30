import { agent, defineTool, p, s } from "rig";

// Agent role: analyze JavaScript source map files and classify their mapping density.
const sourceMapAnalyzer = agent({
  model: "typecheck",
  instructions: p`Analyze JavaScript source map files in this workspace.

Source map files found:
${p.bash("find . -name '*.js.map' -not -path '*/node_modules/*' 2>/dev/null | head -50")}

Use the parseSourceMap tool to read and analyze each source map file.
For each file, determine sourceCount, mapping density, and whether sourcesContent is present.
Return a record keyed by source map file path. Return only the declared output.`,
  tools: [
    defineTool("parseSourceMap", {
      description: "Parse a source map file and extract metadata",
      parameters: s.object({ filePath: s.string }),
      async handler({ filePath }) {
        const { readFile } = await import("node:fs/promises");
        try {
          const content = await readFile(filePath, "utf-8");
          const map = JSON.parse(content);
          const sourceCount: number = Array.isArray(map.sources) ? map.sources.length : 0;
          const mappingLen: number = typeof map.mappings === "string" ? map.mappings.length : 0;
          const density = mappingLen < 100 ? "sparse" : mappingLen < 1000 ? "medium" : "dense";
          const hasSourcesContent = Array.isArray(map.sourcesContent) && map.sourcesContent.length > 0;
          return { sourceCount, density, hasSourcesContent };
        } catch {
          return { sourceCount: 0, density: "sparse", hasSourcesContent: false };
        }
      },
    }),
  ],
  output: s.record(
    s.object({
      sourceCount: s.int,
      mappingDensity: s.enum("sparse", "medium", "dense"),
      hasSourcesContent: s.boolean,
    })
  ),
});

export default sourceMapAnalyzer;
