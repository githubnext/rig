import { agent, s } from "rig";
// Agent role: extract any JSON object from input.text into raw.
const extractJson = agent({
    model: "typecheck",
    output: s.object({
        raw: s.unknown,
        summary: s.string
    }),
    instructions: `Extract any JSON object from input.text into raw.`,
});
export default extractJson;
