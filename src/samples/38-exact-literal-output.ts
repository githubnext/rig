import { agent, s } from "rig";
// Agent role: extract event metadata. Use undefined when deletedAt is absent.
const parseEvent = agent({
    model: "mini",
    output: s.object({
        title: s.string,
        deletedAt: s.optional(s.string)
    }),
    instructions: `Extract event metadata. Use undefined when deletedAt is absent.`,
});

export default parseEvent;
