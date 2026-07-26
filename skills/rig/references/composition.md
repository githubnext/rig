# Composition

Read this reference when a root agent delegates work or coordinates a dynamic set.

## Named subagents

Expose subagents through an object:

```ts
import { agent, s } from "rig";

// Agent role: extract the most important changes from a diff.
const summarizeDiff = agent({
  model: "nano",
  output: s.object({ summary: s.string }),
});

// Agent role: review a diff with focused summary support.
const reviewer = agent({
  model: "mini",
  agents: { summarizeDiff },
  instructions: "Review the diff. Delegate summarization when useful, then combine the evidence.",
  output: s.object({
    summary: s.string,
    issues: s.array(s.string),
  }),
});

export default reviewer;
```

`agents: { summarizeDiff }` is valid; `agents: [summarizeDiff]` is not. Keep subagents narrow and make the root instructions require one combined final response.

Every declared agent must remain reachable from the exported root. A detached `const extractor = agent(...)` is both unavailable to the harness and likely to trigger TS6133 as an unused variable.

```ts
// wrong: agents must be an object, not an array
const invalid = agent({
  agents: [summarizeDiff],
});
```

## Sequential composition

There is no built-in chain primitive. Attach the upstream agent to the downstream root and describe the sequence:

```ts
import { agent, s } from "rig";

// Agent role: extract key facts from input text.
const extractor = agent({
  model: "nano",
  output: s.object({ facts: s.array(s.string) }),
});

// Agent role: assess extracted facts and return a verdict.
const assessor = agent({
  model: "mini",
  agents: { extractor },
  instructions: "Use extractor first, assess its facts, then return the final verdict.",
  output: s.enum("healthy", "needs-work", "critical"),
});

export default assessor;
```

Two-phase coordinator patterns can pass structured output from one subagent into the next:

```ts
import { agent, p, s } from "rig";

// Agent role: extract per-function line counts.
const extractor = agent({
  model: "nano",
  instructions: p`Run ${p.bash("rg -n '^function|^const .*=>|^export function' src --glob '*.ts'")} and return per-function line counts.`,
  output: s.record(s.number),
});

// Agent role: classify complexity from extracted counts.
const reviewer = agent({
  model: "nano",
  input: s.object({ counts: s.record(s.number) }),
  instructions: "Rate each function in input.counts as simple, moderate, complex, or critical.",
  output: s.record(s.enum("simple", "moderate", "complex", "critical")),
});

// Agent role: orchestrate extraction then review.
const coordinator = agent({
  model: "mini",
  agents: { extractor, reviewer },
  instructions: "Call extractor first, then call reviewer with { counts: extractor output }, and return the review result.",
  output: s.record(s.enum("simple", "moderate", "complex", "critical")),
});

export default coordinator;
```

## Coordinator over a dynamic list

There is no loop primitive for calling a subagent once per item. Give the coordinator the discovered items and explicit per-item delegation instructions; the model drives the loop:

```ts
import { agent, p, s } from "rig";

// Agent role: summarize one file.
const fileSummarizer = agent({
  model: "nano",
  input: s.object({ path: s.path }),
  instructions: p`Summarize ${p.readInput("path")}.`,
  output: s.object({
    path: s.path,
    summary: s.string,
  }),
});

// Agent role: coordinate summaries for every discovered TypeScript file.
const coordinator = agent({
  model: "mini",
  agents: { fileSummarizer },
  instructions: p`Find TypeScript files with ${p.glob("src/**/*.ts")}. For each path, delegate to fileSummarizer, then return a record containing every summary.`,
  output: s.record(s.string, "summaries keyed by path"),
});

export default coordinator;
```

For large lists the model may process a subset. Give it an adequate turn budget and explicit completeness requirements.

## Runnable markdown task harness

When a task asks for runnable markdown:

- include exactly one fenced `rig` block
- include `import { ... } from "rig"` or intentionally rely on inline injection
- define one default-exported root with no required external input
- do not call the root in the snippet
- keep every subagent attached to the root graph
