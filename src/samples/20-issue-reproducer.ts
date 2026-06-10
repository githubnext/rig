import { agent, p, s } from "rig";
const Diagnosis = s.object({
    rootCause: s.string,
    confidence: s.number
});
// Agent role: diagnose the test failure.
const diagnose = agent({
    model: "mini",
    input: s.object({
        test: s.string
    }),
    output: Diagnosis,
    instructions: `Diagnose the test failure.`,
});
// Agent role: make the smallest safe patch using engine capabilities.
const fix = agent({
    model: "mini",
    input: s.object({
        diagnosis: Diagnosis
    }),
    output: s.object({
        changed: s.boolean,
        summary: s.string
    }),
    instructions: `Make the smallest safe patch using engine capabilities.`,
});
// Agent role: review the patch against the diagnosis.
const review = agent({
    model: "mini",
    input: s.object({
        diff: s.string,
        diagnosis: Diagnosis
    }),
    output: s.object({
        approved: s.boolean,
        issues: s.array(s.string)
    }),
    instructions: `Review the patch against the diagnosis.`,
});
const d = await diagnose({ test: p.bash("npm test") });
await fix({ diagnosis: d });
await review({ diff: p.bash("git diff -- ."), diagnosis: d });

// Agent role: orchestrate diagnose/fix/review as the runnable root for this workflow.
const issueReproducer = agent({
    model: "mini",
    instructions: "Use the provided subagents to diagnose, patch, and review a failing test case.",
    output: s.object({
        approved: s.boolean,
        issues: s.array(s.string),
    }),
    agents: { diagnose, fix, review }
});

export default issueReproducer;
