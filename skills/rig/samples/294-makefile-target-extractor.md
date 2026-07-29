# 294-makefile-target-extractor - Makefile Target Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseTarget = defineTool("parseTarget", {
  description: "Parse a Makefile target line and return its metadata",
  parameters: s.object({ line: s.string, phonyTargets: s.string }),
  handler: ({ line, phonyTargets }) => {
    const match = line.match(/^([a-zA-Z0-9_.-]+)\s*:/);
    if (!match) return null;
    const name = match[1];
    const isPhony = phonyTargets.includes(name);
    const hasHelp = line.includes("##");
    const descMatch = line.match(/##\s*(.+)/);
    return { name, isPhony, hasHelp, description: descMatch ? descMatch[1].trim() : undefined };
  },
});

// Agent role: extract and classify targets from a Makefile
const makefileTargetExtractor = agent({
  model: "small",
  instructions: p`Parse the Makefile content: ${p.readOptional("Makefile", "# no Makefile found")}

Use the parseTarget tool for each target line. Collect all targets and their metadata, count phony vs real targets, and return the structured result.`,
  output: s.object({
    targets: s.array(s.object({
      name: s.string,
      isPhony: s.boolean,
      hasHelp: s.boolean,
      description: s.optional(s.string),
    })),
    totalCount: s.int,
    phonyCount: s.int,
  }),
  tools: [parseTarget],
  addons: [repair()],
});

export default makefileTargetExtractor;
```
