import { agent, s } from "rig";
// Agent role: diagnose the failing test result. Do not edit files.
const diagnose = agent({
    model: "typecheck",
    output: s.object({
        rootCause: s.string,
        confidence: s.number,
        relevantFiles: s.array(s.string),
        nextSteps: s.array(s.string)
    }),
    instructions: `
    Diagnose the failing test result.
    Do not edit files.
  `,
});
export default diagnose;
