import { agent, p, s, defineTool, repair, steering } from "rig";

const lookupTicketMetadata = defineTool("lookupTicketMetadata", {
  description: "Extract ticket references like #123 or PROJ-456 from text",
  parameters: s.object({ text: s.string }),
  handler({ text }) {
    const githubRefs = [...text.matchAll(/#(\d+)/g)].map((m) => `#${m[1]}`);
    const jiraRefs = [...text.matchAll(/\b([A-Z]+-\d+)\b/g)].map((m) => m[1]);
    return { githubRefs, jiraRefs, all: [...githubRefs, ...jiraRefs] };
  },
});

// Agent role: enrich raw release notes with structured sections, a risk label, and missing reference warnings.
const releaseNoteEnricher = agent({
  model: "typecheck",
  input: s.object({
    rawNotes: s.string,
  }),
  instructions: p`You have raw release notes in the input. Use the lookupTicketMetadata tool to extract any ticket references from the text. Group the notes into logical sections (e.g., Features, Bug Fixes, Breaking Changes, Chores). Assign a riskLabel of low, medium, high, or critical based on whether there are breaking changes or critical fixes. List any ticket references that appear in the notes but could not be resolved or verified.`,
  output: s.object({
    sections: s.array(s.object({
      heading: s.string,
      items: s.array(s.string),
    })),
    riskLabel: s.enum("low", "medium", "high", "critical"),
    missingReferences: s.array(s.string),
  }),
  tools: [lookupTicketMetadata],
  maxTurns: 5,
  addons: [steering(), repair()],
});

export default releaseNoteEnricher;
