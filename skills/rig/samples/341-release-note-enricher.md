# 341 - Release Note Enricher

```rig
import { agent, p, s, defineTool, repair, steering } from "rig";

const lookupTicketMetadata = defineTool("lookupTicketMetadata", {
  description: "Extract ticket references (#NNN or PROJ-NNN) from text and return metadata",
  parameters: s.object({ text: s.string }),
  handler({ text }) {
    const githubRefs = [...text.matchAll(/#(\d+)/g)].map((m) => `#${m[1]}`);
    const jiraRefs = [...text.matchAll(/\b([A-Z]+-\d+)\b/g)].map((m) => m[1]);
    return { githubRefs, jiraRefs, all: [...githubRefs, ...jiraRefs] };
  },
});

// Agent role: enrich raw release notes by extracting ticket references, grouping into sections, assigning a risk label, and listing unresolved references.
const releaseNoteEnricher = agent({
  model: "small",
  input: s.object({ rawNotes: s.string }),
  instructions: p`Use the lookupTicketMetadata tool to find all ticket references (#NNN, PROJ-NNN) in the raw release notes from the input. Group the notes into logical sections (e.g., Features, Bug Fixes, Breaking Changes). Assign a riskLabel based on content severity. List any ticket references that appear to be missing or unresolvable.`,
  output: s.object({
    sections: s.array(s.string),
    riskLabel: s.enum("low", "medium", "high", "critical"),
    missingReferences: s.array(s.string),
  }),
  tools: [lookupTicketMetadata],
  maxTurns: 5,
  addons: [steering(), repair()],
});

export default releaseNoteEnricher;
```
