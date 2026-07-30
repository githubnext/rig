import { agent, s } from "rig";
// Agent role: create a focused validation plan for the current changes.
const planner = agent({
    model: "typecheck",
    output: s.object({
        commands: s.array(s.string),
        manualChecks: s.array(s.string),
        rationale: s.string
    }),
    instructions: `Create a focused validation plan for the current changes.`,
});
export default planner;
