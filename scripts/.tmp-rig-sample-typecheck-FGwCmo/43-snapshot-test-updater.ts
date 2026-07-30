import { agent, s } from "rig";
// Agent role: repair input.text into a JSON-compatible value.
const repair = agent({
    model: "typecheck",
    output: s.object({
        repaired: s.unknown,
        changes: s.array(s.string)
    }),
    instructions: `Repair input.text into a JSON-compatible value.`,
});

export default repair;
