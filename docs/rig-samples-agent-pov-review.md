# Rig samples review from an agent POV

This review critiques sample design, syntax, and intuitiveness across `src/samples/*` and `skills/rig/samples/*`.

## What works well

1. **Small core surface area**  
   The `agent + s + p` API is compact and repeatable, which makes generation predictable once the pattern is learned.

2. **Strong output contracts**  
   Most samples use explicit `s.object(...)` outputs and enums, which is friendly to repair loops and machine consumption.

3. **Real task coverage**  
   The catalog covers practical workflows (triage, CI diagnosis, release planning, delegation) instead of toy prompts.

## Design and intuitiveness issues

1. **Root-agent mental model is unclear in multi-agent examples**  
   Several orchestrated samples run multiple agents but export a subagent as default (`20-issue-reproducer.ts`, `36-subagent-delegation.ts`, `50-end-to-end-release-agent.ts`, `51-claude-design.ts`, `53-ralf-loop.ts`).  
   For an agent author, this makes "what is the runnable root?" ambiguous.

2. **Sample style drifts from documented guidance**  
   Docs recommend `p.read(...)` when reading files, but samples still frequently use `p.bash("cat ...")` (`23-schema-inference.ts`, `41-parse-coverage.ts`, and others).  
   This weakens trust in the docs as the canonical source.

3. **Verbose schema ceremony for simple tasks**  
   The explicit schema style is correct, but for quick one-shot tasks the amount of typing can feel heavier than direct SDK usage.

4. **Inline skill sample trust is currently broken by a failing example**  
   `skills/rig/samples/52-claude-design.md` exports a root agent that requires input, but stdin inline mode expects no-input root agents.  
   A failing checked-in sample reduces confidence for both humans and agents.

## Syntax critique

- **Good:** declarative schemas and explicit enums reduce ambiguity.
- **Good:** `p\`\`` with inline intents is expressive for agent-authored prompts.
- **Rough edge:** syntax is concise at runtime but still repetitive in examples with many tiny helper agents.
- **Rough edge:** mixed formatting styles across samples (some compact, some highly expanded) make pattern extraction harder for generation agents.

## Would an agent choose `rig` or Copilot SDK directly?

### Agent would likely choose `rig` when

- the task is schema-first and expects strict JSON output;
- shell/file context can be expressed with `p.read/p.bash` intents;
- the goal is to generate a runnable sample quickly with consistent scaffolding.

### Agent would likely choose Copilot SDK directly when

- orchestration needs custom session lifecycle control, transport, or event handling;
- the workflow is long-running and not naturally expressed as one root `agent(...)` contract;
- the task needs non-standard control flow where harness conventions become constraints.

## Bottom line

`rig` is more attractive than direct Copilot SDK for most sample-style, structured tasks because it compresses boilerplate into a predictable pattern.  
However, sample inconsistencies (root export ambiguity, file-read style drift, and one failing markdown sample) currently make the experience feel less intuitive than it could be.
