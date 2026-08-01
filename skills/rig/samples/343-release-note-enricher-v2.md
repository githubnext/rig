# 343 - Release Note Enricher V2

```rig
import { agent, p, s, defineTool, repair, steering } from "rig";

// Agent role: Enrich raw release notes by extracting ticket references, organizing into sections, and assessing risk level.
const releaseNoteEnricher = agent({
  model: "small",
  input: s.object({ rawNotes: s.string }),
  instructions: p`You are a release note enricher. Enrich the following raw release notes.

Raw notes provided as input: {{rawNotes}}

${defineTool("lookupTicketMetadata", {
  description: "Look up metadata for a ticket reference like #123 or PROJ-456",
  parameters: s.object({ ticketId: s.string }),
  handler: (args) => {
    const githubMatch = args.ticketId.match(/^#(\d+)$/);
    const jiraMatch = args.ticketId.match(/^([A-Z]+-\d+)$/);
    if (githubMatch) return { found: true, type: "github-issue" as const, id: githubMatch[1] };
    if (jiraMatch) return { found: true, type: "jira" as const, id: jiraMatch[1] };
    return { found: false, type: "unknown" as const, id: args.ticketId };
  },
})}

Extract all ticket references (#NNN or PROJ-NNN patterns), organize the notes into sections, assess risk, and return structured output.`,
  output: s.object({
    sections: s.array(s.object({
      heading: s.string,
      items: s.array(s.string),
    })),
    riskLabel: s.enum("low", "medium", "high", "critical"),
    missingReferences: s.array(s.string),
  }),
  addons: [steering(), repair()],
});

export default releaseNoteEnricher;
```
