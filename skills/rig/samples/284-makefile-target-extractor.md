# 284 - Makefile Target Extractor

```rig
import { agent, defineTool, p, s, repair } from "rig";

const parseTargets = defineTool("parseTargets", {
  description: "Parse Makefile content to extract phony and real targets with descriptions.",
  parameters: s.object({ content: s.string }),
  handler({ content }: { content: string }) {
    const lines = content.split("\n");
    const phonySet = new Set<string>();
    const targets: Array<{ name: string; isPhony: boolean; hasHelp: boolean; description?: string }> = [];

    for (const line of lines) {
      const phonyMatch = line.match(/^\.PHONY\s*:\s*(.+)/);
      if (phonyMatch) {
        for (const t of phonyMatch[1].split(/\s+/)) phonySet.add(t.trim());
      }
    }

    const targetRe = /^([a-zA-Z0-9_\-./]+)\s*:/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(targetRe);
      if (m && !m[1].startsWith(".")) {
        const name = m[1];
        const helpLine = i > 0 ? lines[i - 1] : "";
        const hasHelp = /##/.test(helpLine) || /##/.test(lines[i]);
        const description = helpLine.match(/##\s*(.+)/)?.[1]?.trim();
        targets.push({ name, isPhony: phonySet.has(name), hasHelp, ...(description ? { description } : {}) });
      }
    }
    return targets;
  },
});

// Agent role: extract and classify Makefile targets.
const makefileTargetExtractor = agent({
  model: "small",
  addons: repair(),
  instructions: p`Extract and classify targets from the project Makefile.

Makefile contents:
${p.readOptional("Makefile", "(no Makefile found)")}

Call parseTargets with the full Makefile content. Return the array of targets and include totalCount (all targets) and phonyCount (targets where isPhony is true).`,
  tools: [parseTargets],
  output: s.object({
    targets: s.array(
      s.object({
        name: s.string,
        isPhony: s.boolean,
        hasHelp: s.boolean,
        description: s.optional(s.string),
      })
    ),
    totalCount: s.int,
    phonyCount: s.int,
  }),
});

export default makefileTargetExtractor;
```
