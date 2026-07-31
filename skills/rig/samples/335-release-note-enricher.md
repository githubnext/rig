# 335 - Release Note Enricher

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const lookupTicketMetadata = defineTool("lookupTicketMetadata", {
  description: "Extract ticket references (#NNN or PROJ-NNN) from text",
  parameters: s.object({ text: s.string }),
  handler: ({ text }: { text: string }) => {
    const githubRefs = text.match(/#\d+/g) ?? [];
    const projectRefs = text.match(/[A-Z]+-\d+/g) ?? [];
    return { githubRefs, projectRefs, found: githubRefs.length + projectRefs.length };
  },
});

// Agent role: enrich raw release notes by extracting ticket references, categorizing sections, and assessing risk.
const releaseNoteEnricher = agent({
  model: "small",
  input: s.object({ rawNotes: s.string }),
  instructions: p`Enrich the provided release notes. Call lookupTicketMetadata to extract ticket references.
Then organize notes into sections (features/bugfixes/breaking/chores), assign a risk label, and list any unresolved references.`,
  output: s.object({
    sections: s.array(s.object({
      title: s.string,
      items: s.array(s.string),
    })),
    riskLabel: s.enum("low", "medium", "high", "critical"),
    missingReferences: s.array(s.string),
  }),
  tools: [lookupTicketMetadata],
  addons: [steering(), repair()],
  maxTurns: 6,
});

export default releaseNoteEnricher;
```
