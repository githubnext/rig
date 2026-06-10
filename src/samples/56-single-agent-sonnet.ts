import { agent, s } from "rig";

// Minimal single-agent sample used by integration tests to verify sonnet runtime execution.
// Agent role: write a single haiku about the user's topic.
const sonnetHaiku = agent({
  name: "single-agent-sonnet-haiku",
  model: "claude-sonnet-4.5",
  output: s.object({
    haiku: s.string,
  }),
  instructions: `
    Write one haiku about the user's topic.
    Return exactly three short lines in the haiku field.
  `,
});

export default sonnetHaiku;
