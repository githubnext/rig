# rig

`rig` is a minimal TypeScript agent harness skill for typed agents, workflows,
and runnable `rig` markdown fences.

<img src="docs/lifecycle.svg" alt="Agentic Workflow Lifecycle — how a Markdown brief becomes a live, AI-powered GitHub Actions workflow" width="100%"/>

## Install

```bash
gh skill install githubnext/rig rig
```

Requires GitHub CLI 2.90.0 or later. Running programs requires Node.js 24 or
later. The `run.ts` entry point installs missing skill dependencies with npm
(lifecycle scripts disabled), then launches the program.

Use `gh skill list` to find the installed skill directory. npm must be on PATH,
and the directory must be writable with registry access for the first install.
The launcher examples below use paths from a repository
checkout; for an installed skill, substitute its directory for `skills/rig`.

`skills/rig/SKILL.md` is the canonical, publishable skill manifest.

To run from a checkout:

```bash
git clone https://github.com/githubnext/rig.git
cd rig
npm ci
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
tools:
  bash: ["node"]
```

Only `node` needs a Bash grant to bootstrap and launch the installed skill.
Use heredocs or redirections rather than `cat`/`echo` pipelines, and allow the
Node/npm registry network ecosystem for missing dependencies. Grant additional
commands only for the program's own tool calls. This is a smaller tool
allowlist, not a security boundary: Node can still start subprocesses.

The [Rig Skill Integration workflow](.github/workflows/rig-skill-integration.md)
tests the skill from the current checkout daily or via `workflow_dispatch`.
It runs three `small` Copilot SDK judges (clarity, safety, feasibility) against
a harmless dummy request and computes the majority verdict in TypeScript.
There is no synthesis call or retry; missing or invalid results fail the run.
Success is recorded in the run logs without creating an issue or pull request.

Then write a Rig program. Here is a release coordinator with specialized
subagents. Their ordering is prompt-directed; use `workflow()` for deterministic
orchestration.

```ts
import { agent, p, s } from "rig";

// Agent role: summarize the release candidate changes.
const analyzeChanges = agent({ model: "small",
  input: s.object({ diff: s.string, commits: s.string }),
  output: s.object({ summary: s.string, highlights: s.array(s.string) }),
  instructions: "Summarize the release candidate changes.",
});
// Agent role: choose the safest semantic version bump.
const chooseVersion = agent({ model: "small",
  input: s.object({ summary: s.string, highlights: s.array(s.string) }),
  output: s.object({ bump: s.enum("patch", "minor", "major"), rationale: s.string }),
  instructions: "Choose the safest semantic version bump.",
});
// Agent role: draft the release note from the chosen version bump.
const draftRelease = agent({ model: "small",
  input: s.object({ bump: s.enum("patch", "minor", "major"), rationale: s.string, summary: s.string }),
  output: s.object({ title: s.string, checklist: s.array(s.string), risks: s.array(s.string) }),
  instructions: "Draft the release note from the chosen version bump.",
});
// Agent role: plan the next release using the provided specialists.
const releaseAgent = agent({ model: "small",
  instructions: p`Use ${p.bash("git diff -- .")} and ${p.bash("git log --oneline -20")} as context. Delegate to analyzeChanges, then chooseVersion with the analysis, then draftRelease with the selected bump, rationale, and summary. Return the combined release plan.`,
  output: s.object({ title: s.string, bump: s.enum("patch", "minor", "major"), checklist: s.array(s.string), risks: s.array(s.string) }),
  agents: { analyzeChanges, chooseVersion, draftRelease },
});

export default releaseAgent;
```

### 2) Run a Rig program with `skills/rig/run.ts`

By default, Rig selects an engine from `COPILOT_SDK_URI`, `RIG_ENGINE`, or
supported provider API-key variables. Without those settings it uses Copilot
over HTTP at `localhost:7777`. To have the launcher start Copilot over stdio,
append `--server` to a run command; this requires an installed, authenticated
Copilot CLI. Other engines require their SDK dependencies or CLI and credentials;
see the [runtime reference](skills/rig/references/runtime.md).
Its [integration guide](skills/rig/references/runtime.md#choosing-an-integration)
compares engine capabilities, model selection, tool ownership, and output
enforcement.

**Design on the fly** — just describe what you want as a string and let the model figure out the rest:

```bash
node skills/rig/run.ts <<'RIG'
export default "Run npm test, diagnose any failures, apply the smallest safe fix, and repeat up to 3 times.";
RIG
```

Or ask Copilot (with the skill) to generate a full program for you. Describe your goal in natural language and Copilot returns a runnable `rig` markdown fence like this:

````markdown
```rig
import { agent, p, s } from "rig";
// Agent role: diagnose failing tests and decide if the loop is done.
const diagnose = agent({
  model: "small",
  input: s.object({ ok: s.boolean, stdout: s.string, exitCode: s.number }),
  output: s.object({ done: s.boolean, rootCause: s.string }),
  instructions: "Diagnose test failures. Set done to true if all tests passed.",
});
// Agent role: apply the smallest safe fix for the root cause.
const fix = agent({
  model: "small",
  output: s.object({ summary: s.string, changed: s.boolean }),
  instructions: "Apply the smallest safe fix for the root cause.",
});
// Agent role: run a RALF loop iterating diagnose-fix cycles until tests pass.
const ralfLoop = agent({
  model: "small",
  output: s.object({ iterations: s.number, fixed: s.boolean }),
  agents: { diagnose, fix },
  instructions: p`Run ${p.bash("npm test")} then loop: diagnose failures, fix, repeat up to 3 times.`,
});
export default ralfLoop;
```
````

Pass the fence contents directly to the launcher with a heredoc:

```bash
node skills/rig/run.ts <<'RIG'
// Paste the rig fence contents here.
RIG
```

Or run a program file:

```bash
node skills/rig/run.ts src/program.ts <<'INPUT'
Review this diff
INPUT
```

Use `--typecheck` to validate a program without running it:

```bash
node skills/rig/run.ts --typecheck < program.ts
```

This uses `npx` to run TypeScript 5.9.3 and may require npm registry access
if that version is not cached.

## Docs

See [skills/rig/SKILL.md](skills/rig/SKILL.md) for construction rules,
[skills/rig/references/runtime.md](skills/rig/references/runtime.md) for launcher and engine details, and
[skills/rig/references/claude-workflow-conversion.md](skills/rig/references/claude-workflow-conversion.md)
for porting Claude Code dynamic workflows to rig.
