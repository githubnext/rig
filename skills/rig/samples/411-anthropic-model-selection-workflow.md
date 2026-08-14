# 411 - Anthropic Model Selection Workflow

Demonstrates running a rig workflow on Claude models via `anthropicEngine()`.
Claude dynamic workflows run on Claude by default; this sample shows how to
match that behaviour in rig — the most common engine question when porting.

Register `anthropicEngine()` once at startup (or set `RIG_ENGINE=anthropic`), then
select model tiers per-agent or per-call with the same `{ model }` option used in
Claude dynamic workflows.

```
Claude dynamic workflow          →   rig
agent(prompt)                        call.text(prompt)
agent(prompt, { model: "sonnet" })   call.text(prompt, { model: "claude-sonnet-4-5" })
agent(prompt, { schema, model: "opus" })  call.json(prompt, schema, { model: "claude-opus-4-5" })
```

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping and model-id table.

```rig
import { agent, configureAgent, s, workflow } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

// Register the Anthropic engine — reads ANTHROPIC_API_KEY from the environment.
configureAgent(anthropicEngine());
// Agent role: classify a ticket using a fast, low-cost Claude model.
const classifier = agent({
  model: "claude-haiku-3-5",  // fast tier — { model: "haiku" } in a Claude dynamic workflow
  input: s.object({ text: s.string }),
  output: s.object({ priority: s.enum("high", "medium", "low") }),
  instructions: "Classify the priority of the support ticket.",
});

// Workflow role: discover tickets, classify with a fast model, then draft
// replies for high-priority ones using a more capable model.
export default workflow({
  meta: { name: "ticketResponder", description: "Classify then reply", phases: ["Classify", "Draft"] },
  body: async ({ call, phase, pipeline }) => {
    phase("Classify");
    const raw = await call.text("List 3 short fictional support tickets, one per line.");
    const tickets = (raw ?? "").split("\n").map((t: string) => t.trim()).filter(Boolean);
    const classified = await pipeline(tickets, (text) => call(classifier, { text }));
    phase("Draft");
    // Per-call model override — matches { model: "sonnet" } in a Claude dynamic workflow.
    return pipeline(
      tickets.filter((_, i) => classified[i]?.priority === "high"),
      (text) => call.text(`Draft a reply for: "${text}"`, { model: "claude-sonnet-4-5" }),
    );
  },
});
```
