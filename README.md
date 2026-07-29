# rig

`rig` is a minimal TypeScript agent harness skill for sandboxed agentic workflows.

## Install

```bash
npm install github:githubnext/rig#v0.0.8
```

Or install the skill for Copilot coding agent:

```bash
gh skills clone githubnext/rig
```

## Quick start

```ts
import { agent, p, s } from "rig";

// Agent role: review the current diff and return prioritized findings.
const reviewDiff = agent({
  model: "small",
  instructions: p`Review ${p.bash("git diff -- .")} and return only the declared output.`,
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
  }),
});

export default reviewDiff;
```

Run it:

```bash
echo "check this" | node skills/rig/rig.ts program.ts
```

## Full API reference

See [skills/rig/SKILL.md](skills/rig/SKILL.md) for construction rules, schema helpers, prompt intents, addons, tools, dynamic workflows, engines, and the launcher CLI.

## Local development

```bash
npm test
npm run typecheck
```
