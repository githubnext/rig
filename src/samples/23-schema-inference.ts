import { agent, p, s } from "rig";
// Agent role: normalize the config into a JSON-compatible object.
const normalize = agent({
    model: "mini",
    output: s.object({
        normalized: s.unknown,
        warnings: s.array(s.string)
    }),
    instructions: `Normalize the config into a JSON-compatible object.`,
});
await normalize(p.read("config.json"));

export default normalize;
