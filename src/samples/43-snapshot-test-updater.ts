import { agent, s } from "rig";
// Agent role: repair input.text into a JSON-compatible value.
const repair = agent({
    model: "mini",
    output: s.object({
        repaired: s.unknown,
        changes: s.array(s.string)
    }),
    instructions: `Repair input.text into a JSON-compatible value.`,
});
await repair("{name: 'rig', trailing: true,}");

export default repair;
