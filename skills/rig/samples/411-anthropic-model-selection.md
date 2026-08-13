# 411 - Anthropic Engine with Per-Call Model Selection

Demonstrates running a ported Claude dynamic workflow on real Claude models
using `anthropicEngine()`. This covers two patterns Claude users reach for when
porting: a stable model on the `agent`, and a per-call override on individual
`call` sites.

Claude dynamic workflows use `{ model: "sonnet" }` or `{ effort: "high" }` in
agent calls. rig passes the model id directly to the Anthropic SDK — no
normalization — so use the full API id.

**Set up the engine once** (or set `RIG_ENGINE=anthropic`):

```ts
import { configureAgent } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

configureAgent(anthropicEngine()); // reads ANTHROPIC_API_KEY
```

**Claude dynamic workflow** (original):

```js
export const meta = { name: "code-review", description: "Review a pull-request diff",
  phases: ["Triage", "Review"] }

// Triage with a fast model, do deep review with a more capable one
phase("Triage")
const triage = await agent("Is this diff risky? Answer yes or no.", {
  model: "haiku", schema: { type: "object", required: ["risky"],
    properties: { risky: { type: "boolean" } }, additionalProperties: false } })

phase("Review")
const detail = triage?.risky
  ? await agent("Review the diff in depth.", { model: "opus" })
  : "Low-risk diff — skipping deep review."
return { triage, detail }
```

**Rig port**:

```rig
import { p, s, workflow } from "rig";

// Workflow role: triage a diff quickly, then do a deep review only when risky.
// model ids map directly: haiku → "claude-haiku-3-5", opus → "claude-opus-4-5".
export default workflow({
  meta: { name: "code-review", description: "Review a pull-request diff", phases: ["Triage", "Review"] },
  body: async ({ call, phase }) => {
    phase("Triage");
    // Fast model for the quick triage — override per call with { model }.
    const triage = await call.json(
      p`Is this diff risky? Answer yes or no.\n${p.bash("git diff HEAD~1 -- . 2>/dev/null | head -200")}`,
      s.object({ risky: s.boolean }),
      { model: "claude-haiku-3-5", label: "triage" },
    );
    phase("Review");
    // { effort: "high" } in a Claude workflow → more capable model id in rig.
    const detail = triage?.risky
      ? await call.text(
          p`Review this diff in depth and identify the top three concerns.\n${p.bash("git diff HEAD~1 -- . 2>/dev/null | head -500")}`,
          { model: "claude-opus-4-5", label: "deep-review" },
        )
      : "Low-risk diff — skipping deep review.";
    return { triage, detail };
  },
});
```

> **No `effort` knob.** rig has no `{ effort: "high" }` option. Choose a model
> tier directly: `"claude-haiku-3-5"` (fast), `"claude-sonnet-4-5"` (balanced),
> `"claude-opus-4-5"` (most capable). Set it on `agent({ model })` for a stable
> default or override per call with `{ model }` as shown above.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping and the Anthropic engine setup instructions.
