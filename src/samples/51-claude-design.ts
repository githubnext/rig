import { agent, s } from "rig";

// Agent role: write an initial response to the user request.
const writer = agent({
    model: "mini",
    output: s.object({ draft: s.string }),
    instructions: "Write a helpful, clear response to the request.",
});

// Agent role: critique the draft against helpfulness, harmlessness, and honesty principles.
const critic = agent({
    model: "mini",
    input: s.object({ request: s.string, draft: s.string }),
    output: s.object({
        issues: s.array(s.string),
        score: s.number,
        acceptable: s.boolean,
    }),
    instructions: "Evaluate the draft against helpfulness, harmlessness, and honesty principles.",
});

// Agent role: revise the draft to address all issues identified by the critic.
const reviser = agent({
    model: "mini",
    input: s.object({
        request: s.string,
        draft: s.string,
        issues: s.array(s.string),
    }),
    output: s.object({ response: s.string }),
    instructions: "Revise the draft to address all issues identified by the critic.",
});

const request = "Explain how to safely handle and dispose of old batteries.";
const { draft } = await writer(request);
const critique = await critic({ request, draft });
await reviser({ request, draft, issues: critique.issues });

// Agent role: orchestrate writer/critic/reviser as the runnable root for this loop.
const claudeDesignLoop = agent({
    model: "mini",
    instructions: "Use the provided subagents to draft, critique, and revise one final response.",
    output: s.object({ response: s.string }),
    agents: { writer, critic, reviser },
});

export default claudeDesignLoop;
