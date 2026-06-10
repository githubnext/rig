import { agent, p, s } from "rig";

// Agent role: diagnose the root cause of test failures and decide if all tests pass.
const diagnose = agent({
  model: "mini",
  input: s.object({
    test: s.string,
  }),
  output: s.object({
    done: s.boolean,
    rootCause: s.string,
  }),
  instructions: "Diagnose the root cause of test failures. Set done to true if all tests pass.",
});

// Agent role: apply the smallest safe fix to address the diagnosed root cause.
const fix = agent({
  model: "mini",
  input: s.object({
    rootCause: s.string,
  }),
  output: s.object({
    summary: s.string,
    changed: s.boolean,
  }),
  instructions: "Apply the smallest safe fix to address the diagnosed root cause.",
});

const MAX_ITERATIONS = 3;
for (let i = 0; i < MAX_ITERATIONS; i++) {
  const d = await diagnose({ test: p.bash("npm test") });
  if (d.done) break;
  await fix({ rootCause: d.rootCause });
}

// Agent role: orchestrate diagnose/fix iterations as the runnable root for this loop.
const ralfLoop = agent({
  model: "mini",
  instructions: "Use the provided subagents to iterate diagnose/fix until done.",
  output: s.object({
    done: s.boolean,
    rootCause: s.string,
  }),
  agents: { diagnose, fix },
});

export default ralfLoop;
