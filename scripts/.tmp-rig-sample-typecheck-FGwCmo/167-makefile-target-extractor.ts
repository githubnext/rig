import { agent, defineTool, p, repair, s } from "rig";

// Agent role: extract and classify Makefile targets into phony vs real file targets with descriptions.
const makefileTargetExtractor = agent({
  model: "typecheck",
  instructions: p`Extract and classify all targets from the Makefile in this workspace.

Makefile contents:
${p.readOptional("Makefile")}

Use the parseTargets tool to extract target names, then classify each. Phony targets are declared with .PHONY or have no corresponding file. Check if each target has an adjacent comment (##) for help text. Return only the declared output.`,
  tools: [
    defineTool("parseTargets", {
      description: "Parse Makefile content and extract target names with their type",
      parameters: s.object({ content: s.string }),
      handler({ content }) {
        const phonyTargets = new Set<string>();
        const phonyMatch = content.match(/^\.PHONY\s*:(.*)/gm) || [];
        for (const line of phonyMatch) {
          line.replace(/^\.PHONY\s*:/, "").trim().split(/\s+/).forEach((t: string) => phonyTargets.add(t));
        }
        const targetLines = content.match(/^([a-zA-Z0-9_-]+)\s*:/gm) || [];
        const targets = targetLines
          .map((l: string) => l.replace(/:.*/, "").trim())
          .filter((t: string) => t && t !== ".PHONY");
        return { targets, phonyTargets: [...phonyTargets] };
      },
    }),
  ],
  addons: [repair()],
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
});

export default makefileTargetExtractor;
