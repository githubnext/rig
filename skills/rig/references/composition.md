# Composition and addons

Read this reference when a root agent delegates work, coordinates a dynamic set, or needs retry/addon behavior.

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

For large lists the model may process a subset. Give it an adequate turn budget, explicit completeness requirements, and repair when structured completeness matters.

## Runnable markdown task harness

When a task asks for runnable markdown:

- include exactly one fenced `rig` block
- include `import { ... } from "rig"` or intentionally rely on inline injection
- define one default-exported root with no required external input
- do not call the root in the snippet
- keep every subagent attached to the root graph

## Repair

Rig starts with no addons. `maxTurns` is only the total budget; automatic parse/schema correction requires `repair()`:

```ts
import { agent } from "rig";
import { repair } from "rig/addons";

// Agent role: return a valid concise summary.
const summarize = agent({
  model: "mini",
  maxTurns: 3,
  addons: repair(),
});

export default summarize;
```

`repair()` takes no options. The budget includes the initial attempt and all retries — for example, `maxTurns: 3` means one initial attempt plus two repair retries. Configure `maxTurns` on the agent spec; a call-time value can override it.

## Final-turn steering

`steering()` appends a last-chance warning to the final retry prompt produced by `repair`. Put it before `repair` so it can observe the repair prompt as the addon chain unwinds:

```ts
import { agent } from "rig";
import { repair, steering } from "rig/addons";

// Agent role: return a valid concise summary with final-turn steering.
const summarize = agent({
  model: "mini",
  maxTurns: 3,
  addons: [steering(), repair()],
});

export default summarize;
```

Use `repair()` alone when the validation error is enough guidance. Pass custom warning text in an options object, as in `steering({ message: "Return valid JSON now." })`; a positional string is invalid. Do not use `steering()` without `repair()`, because it only augments prompts generated by repair.

## One-time runtime registration

`oncePerAgent(register)` invokes its callback exactly once per runtime agent instance — not once per turn and not once per retry. The callback receives `(agent: Agent, context: AgentAddonContext)`. Use it for one-time initialization such as registering a tool adapter or constructing a client:

```ts
import { agent, s } from "rig";
import { oncePerAgent, repair } from "rig/addons";

// Agent role: answer after one-time runtime initialization.
const qa = agent({
  model: "mini",
  addons: [
    oncePerAgent(async (runtimeAgent) => {
      // e.g. register a tool adapter on the runtime agent once
      await runtimeAgent.ask("initialize");
    }),
    repair(),
  ],
});

export default qa;
```

`oncePerAgent` tracks initialization via its own internal `WeakSet`; do not add an external `WeakSet` to track the same thing. Repair retries reuse the same runtime agent, so the registration still runs once.

Both `addons: singleAddon` and `addons: [addon1, addon2]` are valid. Prefer the array form when combining addons.

## Addon lifecycle

Per-turn addon context contains:

- `prompt`, `response`, `output`
- `turn`, `maxTurns`
- `signal`, `agent`
- `nextPrompt`, `error`, `completed`

Put stable addons in the agent spec. Add later behavior with `agent.use(addon)`; `.use()` does not accept model, turn, timeout, or signal options.
