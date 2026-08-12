# 414 - Makefile Phony Extractor V2

```rig
import { agent, p, s, steering, defineTool } from "rig";

const extractPhonyTargets = defineTool("extractPhonyTargets", {
  description: "Extract .PHONY declarations and all target rules from Makefile content.",
  parameters: s.object({ content: s.string }),
  handler: ({ content }: { content: string }) => {
    const phonyLines = content.match(/^\.PHONY:\s*(.+)$/mg) ?? [];
    const targetLines = content.match(/^([a-zA-Z][a-zA-Z0-9_.-]*):/mg) ?? [];
    const phonies = new Set(
      phonyLines.flatMap((l: string) => l.replace(".PHONY:", "").trim().split(/\s+/))
    );
    const targets = [...new Set(targetLines.map((l: string) => l.replace(":", "").trim()))];
    return { phonies: [...phonies], targets, hasAll: phonies.has("all") || targets.includes("all") };
  },
});

// Agent role: Read a Makefile and extract all targets, marking which are declared .PHONY.
const makefilePhonyExtractorV2 = agent({
  model: "small",
  instructions: p`Makefile content:
${p.readOptional("Makefile")}

Call the extractPhonyTargets tool with the Makefile content. Build a targets list where isPhony is true for targets in the .PHONY list. Return phonyCount, totalCount, and hasAll.`,
  tools: [extractPhonyTargets],
  output: s.object({
    targets: s.array(s.object({ name: s.string, isPhony: s.boolean })),
    phonyCount: s.int,
    totalCount: s.int,
    hasAll: s.boolean,
  }),
  addons: [steering()],
});

export default makefilePhonyExtractorV2;

```
