# 325 - Release Note Enricher

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

// Agent role: enrich raw release notes by extracting ticket references and organizing entries into categorized sections.
const releaseNoteEnricher = agent({
  model: "small",
  input: s.object({ rawNotes: s.string }),
  instructions: p`Enrich the following release notes from input.rawNotes.
Use the lookupTicketMetadata tool to resolve any ticket references (#NNN or PROJ-NNN).
Organize entries into sections (e.g., Features, Bug Fixes, Breaking Changes).
Assign a risk label and list any references that could not be resolved.`,
  output: s.object({
    sections: s.array(s.object({
      heading: s.string,
      items: s.array(s.string),
    })),
    riskLabel: s.enum("low", "medium", "high", "critical"),
    missingReferences: s.array(s.string),
  }),
  tools: [
    defineTool("lookupTicketMetadata", {
      description: "Extract and return stub metadata for ticket references found in release notes text",
      parameters: s.object({ references: s.array(s.string) }),
      handler({ references }) {
        return references.map((ref: string) => ({
          ref,
          title: `Title for ${ref}`,
          status: "closed",
        }));
      },
    }),
  ],
  addons: [steering(), repair()],
});

export default releaseNoteEnricher;
```
