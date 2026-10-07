# Rig

**Small TypeScript agents with typed inputs, validated outputs, and composable workflows.** Write a program, hand it to the Rig skill, or run it with the launcher. Rig uses the Copilot SDK by default and also supports Anthropic, Codex, DeepSeek Harness, Gemini, and Pi [engines](skills/rig/engines.md).

## Get started

Install the skill for your coding agent (GitHub CLI 2.90+):

```bash
gh skill install githubnext/rig rig
```

To run programs locally, use Node.js 24+ and install the dependencies from a checkout:

```bash
git clone https://github.com/githubnext/rig.git
cd rig
npm ci
```

Save this as `review.ts`:

```ts
import { agent, s } from "rig";

// Agent role: assess a proposed change.
export default agent({
  model: "small",
  input: s.string,
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
  }),
  instructions: "Review the proposed change. Summarize it and assess its risk.",
});
```

With an installed, authenticated Copilot CLI, run:

```bash
printf '%s\n' 'Replace the login form' | node skills/rig/run.ts review.ts --server
```

The launcher reads stdin, runs the exported agent, and prints the validated result. To check without making a model call:

```bash
node skills/rig/run.ts review.ts --typecheck
```

`gh skill install` copies the skill but **does not install SDK dependencies**. For an installed skill, find its directory with `gh skill list` and substitute it for `skills/rig` in the commands above. Without `--server`, Rig selects an engine from your environment or uses the default Copilot endpoint; see [running programs](skills/rig/runtime.md) for launch options.

## In agentic workflows

Pin the [Rig skill](skills/rig/SKILL.md) and [shared launcher template](.github/workflows/shared/rig.md) to full commit SHAs. The template provides Node.js 24 and a narrow `printf`/`node` allowlist; the consuming workflow must enable the Copilot SDK, grant `copilot-requests: write`, and provision dependencies. See the [workflow setup guide](skills/rig/agentic-workflows.md) for the exact configuration and credential handoff.

## Explore

- [Skill guide](skills/rig/SKILL.md) — the canonical program and construction rules.
- [Agent API](skills/rig/agent-api.md) and [prompt intents](skills/rig/prompt-intents.md) — schemas, inputs, and workspace context.
- [Dynamic workflows](skills/rig/dynamic-workflows.md) — deterministic orchestration.
- [Samples](skills/rig/samples/) — ready-to-read agent and workflow patterns.
