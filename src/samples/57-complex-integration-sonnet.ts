import { agent, defineTool, p, s } from "rig";
import { oncePerSession, steering, timeout } from "rig/addons";

const summarizeText = defineTool<{ text: string }>("summarize_text", {
  description: "Create a concise summary from text.",
  parameters: s.object({
    text: s.string,
  }),
  handler: async ({ text }) => {
    const trimmed = text.trim();
    if (!trimmed) return "No content provided.";
    return trimmed.split(/\s+/g).slice(0, 20).join(" ");
  },
});

const planner = agent({
  name: "complex-integration-planner",
  model: "claude-haiku-4.5",
  instructions: "Return 2-3 short plan steps for the provided topic.",
  input: s.object({
    topic: s.string,
  }),
  output: s.object({
    steps: s.array(s.string),
  }),
});

const complexIntegration = agent({
  name: "complex-integration-sonnet",
  model: "claude-sonnet-4.5",
  maxTurns: 4,
  input: s.object({
    topic: s.string,
    audience: s.optional(s.string),
  }),
  output: s.object({
    headline: s.string,
    checklist: s.array(s.string),
    riskLevel: s.enum("low", "medium", "high"),
    nextActions: s.array(s.object({
      owner: s.string,
      action: s.string,
    })),
    contextDigest: s.object({
      repository: s.string,
      usedFeatures: s.array(s.string),
      toolHint: s.string,
    }),
  }),
  tools: [summarizeText],
  agents: { planner },
  addons: [
    oncePerSession(async () => {}),
    timeout({ timeout: 45_000 }),
    steering(),
  ],
  instructions: p`
    Build a compact execution brief for the user topic.
    Use repository context from ${p.read("README.md")} and workspace state from ${p.bash("git status --short")}.
    You may call planner for concise planning and summarize_text for text condensation.
    Mention at least five rig features in contextDigest.usedFeatures.
  `,
});

export default complexIntegration;
