import { agent, p, s } from "rig";
// Agent role: extract any JSON object from input.text into raw.
const extractJson = agent({
    model: "mini",
    output: s.object({
        raw: s.unknown,
        summary: s.string
    }),
    instructions: `Extract any JSON object from input.text into raw.`,
});
await extractJson(p.bash("node ./scripts/print-config.js"));

export default extractJson;
