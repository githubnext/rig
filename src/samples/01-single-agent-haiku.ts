import { agent, s } from "rig";
// Minimal single-agent sample used by integration tests to verify real runtime execution with Copilot auth.
// Agent role: write a single haiku about the user's topic.
const haiku = agent({
  name: "single-agent-haiku",
  model: "claude-haiku-4.5",
  output: s.object({
    haiku: s.string,
  }),
  instructions: `
    Write one haiku about the user's topic.
    Return exactly three short lines in the haiku field.
  `,
});

export default haiku;
