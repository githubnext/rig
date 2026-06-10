import { agent, s } from "rig";

// Agent role: extract the most important implementation details from the topic.

const researcher = agent({
  model: "mini",
  instructions: "Extract the most important implementation details from the topic.",
  input: s.object({
    topic: s.string,
  }),
  output: s.object({
    summary: s.string,
    risks: s.array(s.string),
  }),
});

// Agent role: turn the research summary into concrete next steps for the caller.

const planner = agent({
  model: "mini",
  instructions: "Turn the research summary into concrete next steps for the caller.",
  input: s.object({
    summary: s.string,
    risks: s.array(s.string),
  }),
  output: s.object({
    decision: s.string,
    nextSteps: s.array(s.string),
  }),
});

const research = await researcher({
  topic: "Explain runtime-visible schemas in one paragraph.",
});

await planner(research);

// Agent role: orchestrate research and planning as the runnable root for delegation.
const delegateTask = agent({
  model: "mini",
  instructions: "Use the provided subagents to research a topic and produce practical next steps.",
  output: s.object({
    decision: s.string,
    nextSteps: s.array(s.string),
  }),
  agents: { researcher, planner },
});

export default delegateTask;
