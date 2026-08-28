---
name: Daily Rig Decomposition Benchmark
description: >
  Each day, the agent writes a rig benchmark program from a specification, then runs it:
  it picks one complicated task that would typically benefit from being split across
  sub-agents and sub-models (research, multi-step coding, structured content generation,
  etc.), then solves it two ways — a single model call attempting the whole task at once,
  and a self-contained rig program that decomposes it into sub-agents each free to pick
  their own model — before running a bounded debugging-reflection loop that typechecks and
  executes the decomposed program end-to-end (no repo checkout — the rig CLI comes from the
  frontmatter `skills:` install), grading both solutions against the same criteria, and
  reporting the comparison as a GitHub issue.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  copilot-requests: write
engine:
  id: copilot
  copilot-sdk: true
strict: true
timeout-minutes: 55
checkout: false
skills:
  - githubnext/rig/skills/rig@62675a369146e9f187258f10d4812ef383600523
tools:
  bash: ["*"]
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-issue:
    title-prefix: "[rig-decomposition-bench] "
    labels: [automation, ai-agent]
    close-older-issues: true
    expires: 7
---

## Task

Each run of this workflow is itself a test of the rig skill: **you** write the benchmark
program from the specification below, then run it, then report what happened.

This workflow runs **without checking out the repository**. The `rig` skill is installed
directly from GitHub via the frontmatter `skills:` field only — nothing beyond that
install is prepared: the skill itself ships its own `package.json` (`"name": "rig"`, with
`exports` pointing at its own `rig.ts`/`globals.ts`) and `tsconfig.json`, so generated
programs importing `from "rig"` resolve correctly both at typecheck time and at runtime as
long as the rig CLI subprocess is run with its working directory set to the installed
skill directory (`.github/skills/rig`).

Read `.github/skills/rig/SKILL.md` first, and load the references it routes to that you
actually need (dynamic workflows, prompt intents, composition). Write the program from the
current API described there — do not guess at API shapes.

## Step 1 — write the benchmark program

Write a single self-contained rig TypeScript program to `/tmp/gh-aw/agent/bench.ts` that
implements the specification below. Then typecheck it by piping it to the installed rig
CLI, run from the skill directory so Node's package self-reference resolves the bare
`"rig"` import, and fix any reported errors before running it:

```bash
cd .github/skills/rig && cat /tmp/gh-aw/agent/bench.ts | node rig.ts --typecheck
```

### Hard requirements

These exist because violating them has previously made this workflow exceed its job
timeout. Treat them as non-negotiable:

- **The root default export must be a `workflow()`, never an agent that relays a large
  result.** Orchestration is deterministic TypeScript; the benchmark report is returned by
  the workflow itself. Do not add a coordinator agent whose output schema restates the
  report — making a model re-emit the generated program source and every captured error as
  JSON is slow, expensive, and fails structured-output parsing.
- **The program must bound its own wall clock.** Compute a deadline of roughly 25 minutes
  from module evaluation, and derive every subprocess timeout from the time remaining
  against it: about 2 minutes for a typecheck and 5 minutes for an execution, each clamped
  down to what is left. When the budget is exhausted, skip the remaining work and return
  what was collected instead of blocking.
- **The program imports only from `"rig"`** and configures the Copilot engine in server
  mode.

### Behavior

1. **Pick a task.** A `small` agent picks one concrete, complicated task a person or team
   might face in a single day that would naturally benefit from being split across
   sub-agents running different models — multi-source research and synthesis, a multi-file
   coding task with distinct design/implementation/review phases, a structured report
   combining several independent analyses, or a multi-step data transformation pipeline.
   The task must be self-contained (solvable from its description alone, with no external
   file or live web access) and concrete enough to grade. Prefer variety across domains
   from run to run. It returns a title, a domain, a description, and 3-6 concrete,
   checkable success criteria. Import and add `repair()` to this task-picker agent with
   `maxTurns: 2`, so a malformed structured response gets one corrective retry instead of
   terminating the benchmark with a null result.

2. **Solve it in one call.** A `medium` agent limited to a single turn solves the whole
   task by itself, addressing every success criterion, with no delegation and no tools.
   Define this solver with `output: s.string` so the complete solution can be returned
   verbatim (including Markdown code fences when appropriate), rather than requiring the
   model to wrap it in a JSON object. Record how long this takes.

3. **Solve it by decomposition.** A `medium` agent writes a *second*, self-contained rig
   program that splits the same task across at least two agents — each with a
   `// Agent role: ...` comment, each choosing `small` for simple sub-steps and `medium` or
   `large` for harder ones — coordinated so the final answer combines their outputs rather
   than coming from one agent solving everything. That generated program must import only
   from `"rig"`, take no required input on its root, and export its root via
   `export default` without invoking it.

   Spell the root contract out in the writer's instructions — it has no access to the
   skill, so it will otherwise guess the API. A `workflow()` spec accepts only
   `meta`, an optional `input`, and `body`; it has no `output` or `execute` field, and the
   final `{ solution }` object is simply what `body` returns. An `agent()` root instead
   declares `output: s.object({ solution: s.string })`. Give the writer this skeleton
   verbatim as the required shape — it is abridged to one agent, and the generated program
   still needs at least two:

   ```ts
   import { agent, workflow, s } from "rig";

   // Agent role: <role>
   const analyze = agent({ model: "small", instructions: "...", output: s.string });

   // Workflow role: combines the agents' outputs into the final solution
   export default workflow({
     meta: { name: "decomposed-solution", description: "..." },
     body: async ({ call }) => {
       const analysis = await call(analyze, "...");
       return { solution: analysis ?? "" };
     },
   });
   ```

   Use `s.string` for every agent whose result is source text or another free-form
   solution. Reserve object schemas for structured metadata such as the task picker,
   and do not make any solver re-emit a large solution inside a wrapper object.

   Verify it by piping the source over stdin to the installed rig CLI, run from the skill
   directory so Node's package self-reference resolves the bare `"rig"` import:
   `--typecheck` first, and only on success `--server` to execute it. Give the writer up to
   2 attempts total; on a failure, pass it back its own previous source and the exact
   captured error, repeat the skeleton, and ask it to fix precisely what the error names,
   preserving what already worked — do not invent unrelated API edits of your own. Stop
   early if there is not enough time budget left for another attempt. Record each attempt's
   typecheck and execute pass/fail together with the exact captured output, and parse the
   final solution out of the successful run's JSON stdout. Record how long the whole
   decomposition phase takes.

4. **Grade both.** A `large` agent limited to a single turn scores each solution 0-10 on
   how completely and correctly it satisfies the success criteria, picks a winner of
   `single-call`, `decomposed`, or `tie`, and explains the comparison. It must judge on
   correctness and completeness of content only — not on length, and not on which approach
   produced the solution. When decomposition produced nothing, grade an explicit
   placeholder saying so rather than an empty string.

The workflow returns the task, both durations, both solutions, the per-attempt records,
the final pass/fail status, and the generated program source.

## Step 2 — run it exactly once

```bash
cd .github/skills/rig && cat /tmp/gh-aw/agent/bench.ts | node rig.ts --server \
  > /tmp/gh-aw/agent/bench_output.json 2> /tmp/gh-aw/agent/bench_stderr.txt
```

Run the program **exactly once**, capturing stdout and stderr. It bounds itself, so do not
rewrite it, re-run it, or debug it after this point. If it fails or produces no output,
report that failure with the captured stderr in the issue — a second run would exceed this
job's `timeout-minutes`.

## Step 3 — report

Emit one `create-issue` safe output with:

- **title**: `Daily rig decomposition benchmark — <YYYY-MM-DD> — <winner>`
- **body**:
  - The chosen **task** (title, domain, one-paragraph description, success criteria list).
  - A **timing comparison** table: single-call duration vs. decomposed duration (ms), and
    the decomposed program's final pass/fail status.
  - For each decomposition attempt, in order: the attempt number, typecheck pass/fail, and
    execute pass/fail, with the exact captured error text (if any) in a collapsible
    `<details>` block, and a one-line note on what was fixed in the next attempt (if any).
  - The **grading** results: both scores, the winner, and the grader's rationale, verbatim.
  - The complete, verbatim **single-call solution** in a collapsible `<details>` block.
  - The complete, verbatim **decomposed rig program source** in a ```ts fence, and the
    **decomposed solution** in a collapsible `<details>` block. Never summarize, truncate,
    replace, or omit any part of the program source, regardless of the final status.
  - The **benchmark program you wrote** in Step 1, in a collapsible `<details>` block with
    a ```ts fence.
  - A final **verdict** line naming the winner and summarizing why in one sentence.
  - Do not invent missing data — if a field is empty (e.g. execution never produced valid
    JSON), state that explicitly instead of fabricating content.
