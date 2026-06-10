# Rig syntax review

This review covers the current rig syntax as expressed in:

- `src/rig.ts`
- `skills/rig/SKILL.md`
- all sample programs in `src/samples/`

## Current state

Rig now enforces a single declarative schema style:

- use `s.object(...)` for object shapes
- use `s.array(...)` for arrays
- use `s.record(...)` for records
- use `s.optional(...)` for optional fields
- use `s.enum(...)` explicitly for union values

Implicit schema syntax has been removed from the runtime and sample corpus.
Shorthand object literals, trailing-underscore optional fields, and `{"*": ...}` record sugar are no longer accepted.

## What works well

1. **One canonical schema dialect.** The runtime, samples, and skill documentation all reinforce the same `s.*` style.
2. **Small syntax surface.** `agent`, `s`, `p`, and call-time overrides remain enough to express the full harness.
3. **Consistent runtime contract.** Prompt rendering still emits `<instructions>`, `<output_schema>`, `<input>`, and `<rules>`, with optional `<permissions>` and `<subagents>` blocks.
4. **Better failure mode for invalid declarations.** Runtime validation now rejects non-declarative schemas with a clear error.

## Remaining guidance

1. Keep new samples in the explicit declarative style.
2. Prefer `s.optional(...)` over any naming convention for optional fields.
3. Treat `skills/rig/SKILL.md` and the early samples as the canonical starting points for generated code.
4. Continue keeping the runnable sample corpus green so checked-in examples stay trustworthy.

## Validation

- `npm test`
- `npm run typecheck`
- `npm run sample`
