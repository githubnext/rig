# 460 - YAML Anchor Alias Reporter

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanYamlAnchors = defineTool("scanYamlAnchors", {
  description: "Scan a YAML file for anchor definitions (&name) and alias references (*name)",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const anchorMatches = content.match(/&([A-Za-z0-9_-]+)/g) ?? [];
    const aliasMatches = content.match(/\*([A-Za-z0-9_-]+)/g) ?? [];
    const anchors = anchorMatches.map((m: string) => m.slice(1));
    const anchorCount = anchors.length;
    const aliasCount = aliasMatches.length;
    return { anchorCount, aliasCount, anchors };
  },
});

// Agent role: Scan YAML files for anchor and alias usage and report totals.
const yamlAnchorAliasReporter = agent({
  model: "small",
  instructions: p`Scan these YAML files for anchors and aliases: ${p.glob("**/*.yml")} and ${p.glob("**/*.yaml")}. Call scanYamlAnchors for each file path. Return the full report.`,
  output: s.object({
    files: s.record(s.object({
      anchorCount: s.int,
      aliasCount: s.int,
      anchors: s.array(s.string),
    })),
    totalAnchors: s.int,
    totalAliases: s.int,
  }),
  tools: [scanYamlAnchors],
  addons: [steering(), repair()],
});

export default yamlAnchorAliasReporter;

```
