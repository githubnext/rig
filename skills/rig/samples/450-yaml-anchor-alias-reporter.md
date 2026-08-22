# 450 - YAML Anchor Alias Reporter

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";
import { steering } from "rig";

const extractYamlAnchors = defineTool("extractYamlAnchors", {
  description: "Extract YAML anchor definitions and alias references from a YAML file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const anchors = [...content.matchAll(/&(\w+)/g)].map((m: RegExpMatchArray) => m[1]);
    const aliases = [...content.matchAll(/\*(\w+)/g)].map((m: RegExpMatchArray) => m[1]);
    return {
      anchorCount: anchors.length,
      aliasCount: aliases.length,
      anchors,
      aliases,
    };
  },
});

// Agent role: Report YAML anchor and alias usage across all YAML files in the workspace.
const yamlAnchorAliasReporter = agent({
  model: "small",
  instructions: p`You have these YAML files: ${p.glob("**/*.{yaml,yml}")}.
For each file, call extractYamlAnchors to find anchor definitions (&name) and alias references (*name).
Return per-file counts and lists, plus totals and the most anchored file.`,
  output: s.object({
    files: s.record(s.object({
      anchorCount: s.int,
      aliasCount: s.int,
      anchors: s.array(s.string),
      aliases: s.array(s.string),
    })),
    totalAnchors: s.int,
    totalAliases: s.int,
    mostAnchoredFile: s.optional(s.string),
  }),
  tools: [extractYamlAnchors],
  addons: [steering()],
});

export default yamlAnchorAliasReporter;
```
