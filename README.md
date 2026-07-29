# rig

`rig` is a minimal TypeScript agent harness skill for sandboxed agentic workflows.

## Install

```bash
gh skill install githubnext/rig
```

## Use Rig in 2 ways

### 1) As a skill for Rig programs that use the Copilot SDK

Pin the skill in your workflow:

```yaml
engine:
  id: copilot
  copilot-sdk: true
skills:
  - githubnext/rig/skills/rig/SKILL.md@<full-commit-sha>
```

Then write a Rig program:

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

### 2) Run a Rig program directly with `skills/rig/rig.ts`

Pipe an inline program to the launcher:

```bash
cat <<'RIG' | node skills/rig/rig.ts
// Agent role: summarize this repository in one sentence.
export default "Summarize this repository in one sentence.";
RIG
```

Or run a program file:

```bash
echo "Review this diff" | node skills/rig/rig.ts src/program.ts
```

Use `--typecheck` to validate a program without running it:

```bash
cat program.ts | node skills/rig/rig.ts --typecheck
```

## Docs

See [skills/rig/SKILL.md](skills/rig/SKILL.md) for construction rules and
[skills/rig/references/runtime.md](skills/rig/references/runtime.md) for launcher and engine details.
