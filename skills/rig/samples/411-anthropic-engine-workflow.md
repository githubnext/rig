# 411 - Anthropic Engine Workflow (Claude model selection)

Demonstrates running a rig workflow on **Claude** instead of the default Copilot
engine — the final step when porting a Claude dynamic workflow to rig.

Claude dynamic workflows run on Claude by default. In rig, the engine is
explicit: call `configureAgent(anthropicEngine())` once at startup, then use
full Claude model IDs (`"claude-haiku-3-5"`, `"claude-sonnet-4-5"`,
`"claude-opus-4-5"`) wherever you would have used `{ model: "haiku" }` in a
dynamic workflow. Per-call `{ model }` overrides still work the same way.

| Intent | Claude model id |
| --- | --- |
| Fast / low-cost | `"claude-haiku-3-5"` |
| Balanced (default for most Claude workflows) | `"claude-sonnet-4-5"` |
| Most capable | `"claude-opus-4-5"` |

Set `RIG_ENGINE=anthropic` or call `configureAgent(anthropicEngine())` at the
top of your program. Requires `ANTHROPIC_API_KEY` in the environment.

See
[claude-workflow-conversion.md](../references/claude-workflow-conversion.md#running-with-the-anthropic-engine-claude-models)
for the full engine reference.

```rig
import { configureAgent, s, workflow } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

// Use the Anthropic engine so every agent call goes to Claude.
// Set RIG_ENGINE=anthropic to achieve the same result via the launcher.
configureAgent(anthropicEngine()); // reads ANTHROPIC_API_KEY from the environment

// Workflow role: classify issues by priority using a fast model, then draft a
// fix plan for high-priority ones using a more capable model.
// Per-agent model selection mirrors { model: "haiku" } / { model: "sonnet" }
// in a Claude dynamic workflow.
export default workflow({
  meta: {
    name: "issueTriageWithClaude",
    description: "Triage issues with a fast Claude model and plan fixes with Sonnet",
    phases: ["Triage", "Plan"],
    whenToUse: "Porting a Claude dynamic workflow that relies on model tier selection.",
  },
  input: s.object({ issues: s.array(s.string("Issue description")) }),
  body: async ({ call, input, phase, pipeline }) => {
    phase("Triage");
    // Fast model for cheap classification — equivalent to { model: "haiku" } in a dynamic workflow.
    const triaged = await pipeline(input.issues, (issue: string) =>
      call.json(
        `Classify the priority of this issue: "${issue}"`,
        s.object({ priority: s.enum("high", "medium", "low") }),
        { model: "claude-haiku-3-5", label: issue.slice(0, 32) },
      ));

    phase("Plan");
    const highPriority = input.issues.filter((_, i) => triaged[i]?.priority === "high");
    if (highPriority.length === 0) return { plans: [], skipped: input.issues.length };

    // More capable model for fix planning — equivalent to { model: "sonnet" } in a dynamic workflow.
    const plans = await pipeline(highPriority, (issue: string) =>
      call.json(
        `Draft a concise one-paragraph fix plan for: "${issue}"`,
        s.object({ plan: s.string, effort: s.enum("small", "medium", "large") }),
        { model: "claude-sonnet-4-5", label: `plan:${issue.slice(0, 24)}` },
      ));

    return { plans: plans.filter(Boolean), skipped: input.issues.length - highPriority.length };
  },
});
```
