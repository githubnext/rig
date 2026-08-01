# 348 - Makefile Phony Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";

// Agent role: Extract Makefile targets and classify which are .PHONY, reporting totals and whether an 'all' target exists.
const makefilePhonyExtractor = agent({
  model: "small",
  instructions: p`You are a Makefile phony target extractor.

Makefile content:
${p.readOptional("Makefile")}

${defineTool("extractPhonyTargets", {
  description: "Extract .PHONY declarations and target names from Makefile content",
  parameters: s.object({ content: s.string }),
  handler: (args) => {
    const phonyLines = args.content.match(/^\.PHONY:\s*(.+)$/mg) ?? [];
    const targetLines = args.content.match(/^([a-zA-Z][a-zA-Z0-9_-]*):/mg) ?? [];
    const phonies = phonyLines.flatMap((l: string) =>
      l.replace(".PHONY:", "").trim().split(/\s+/)
    );
    const targets = targetLines.map((l: string) => l.replace(":", "").trim());
    return { phonies, targets, hasAll: phonies.includes("all") };
  },
})}

Parse the Makefile, identify all targets and their phony status, and return the structured result.`,
  output: s.object({
    targets: s.array(s.object({
      name: s.string,
      isPhony: s.boolean,
    })),
    phonyCount: s.int,
    totalCount: s.int,
    hasAll: s.boolean,
  }),
  addons: [steering()],
});

export default makefilePhonyExtractor;
```
