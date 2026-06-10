import { agent, s } from "rig";
// Agent role: classify the GitHub issue and suggest labels.
const classifyIssue = agent({
    model: "mini",
    input: s.object({
        title: s.string,
        body: s.string
    }),
    output: s.object({
        kind: s.enum("bug", "feature", "question", "chore"),
        priority: s.enum("p0", "p1", "p2", "p3"),
        rationale: s.string,
        labels: s.array(s.string)
    }),
    instructions: `Classify the GitHub issue and suggest labels.`,
});
await classifyIssue({
    title: "CLI exits zero after failed upload",
    body: "The command prints an error but exits with code 0.",
});

export default classifyIssue;
