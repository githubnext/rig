import { agent, s } from "rig";
// Agent role: write a concise migration guide.
const migration = agent({
    model: "mini",
    input: s.object({
        fromVersion: s.string,
        toVersion: s.string,
        changes: s.array(s.string)
    }),
    output: s.object({
        title: s.string,
        steps: s.array(s.string),
        examples: s.array(s.object({
            before: s.string,
            after: s.string
        }))
    }),
    instructions: `Write a concise migration guide.`,
});
await migration({
    fromVersion: "0.1",
    toVersion: "0.2",
    changes: ["Agents now always receive input objects."],
});

export default migration;
