# Linting Rig programs

Rig includes a dependency-free linter in the skill folder and exports an ESLint plugin from `rig/eslint`.

Run the linter after generating or changing a Rig program:

```bash
node skills/rig/eslint/lint.js path/to/program.ts
```

Use `--fix` to apply safe fixes:

```bash
node skills/rig/eslint/lint.js --fix path/to/program.ts
```

## Rules

### `rig/define-tool-arg-count`

`defineTool` takes exactly two arguments: a name and a config object. The five-argument positional form is rejected:

```ts
// Invalid
defineTool("echo", "Echo text.", s.object({ text: s.string }), s.object({ echoed: s.string }), ({ text }) => ({ echoed: text }))

// Valid
defineTool("echo", { description: "Echo text.", parameters: s.object({ text: s.string }), handler: ({ text }) => ({ echoed: text }) })
```

The rule fixes the five-argument form automatically.

### `rig/agents-must-be-object`

The `agents` spec field must be a named object, not an array:

```ts
// Invalid
agents: [extractor, reviewer]

// Valid
agents: { extractor, reviewer }
```

The rule fixes array-valued `agents` automatically when all elements are bare identifiers.

### `rig/no-object-literal-record`

An `s.record` or `s.nonEmptyObject` value must be a schema. Wrap object fields with `s.object`:

```ts
// Invalid
s.record({ status: s.string })

// Valid
s.record(s.object({ status: s.string }))
```

The rule fixes the invalid form automatically.

### `rig/repair-no-args`

`repair()` takes no arguments. Turn budgets belong on the agent spec, not in the `repair()` call:

```ts
// Invalid
addons: repair({ maxTurns: 3 })

// Valid — move maxTurns to the agent spec
addons: repair()
```

The rule removes arguments from `repair(...)` automatically.

### `rig/no-implicit-any-in-tool-handler`

Arrow function callbacks passed to array iteration methods (`.map`, `.filter`, `.forEach`, `.find`, `.findIndex`, `.every`, `.some`, `.flatMap`) must use parenthesized parameters so that an explicit type annotation can be added.

Under `noImplicitAny`, TypeScript may fail to infer the callback parameter type when the surrounding context is `any` — for example, when a `defineTool` handler arg is untyped because `parameters` was given as a plain object (`{ content: s.string }`) instead of `s.object({ content: s.string })`. Adding an explicit type prevents the cascade.

```ts
// Invalid — if content is any, TypeScript reports: Parameter 'line' implicitly has an 'any' type
handler: ({ content }) => content.split("\n").map(line => line.trim())

// Valid
handler: ({ content }) => content.split("\n").map((line: string) => line.trim())
```

The rule wraps the parameter in parentheses automatically; add the explicit type annotation (usually `: string` for string arrays, or `: RegExpMatchArray` for `matchAll` results) after the autofix.

## Adding rules

Put rule implementations in `skills/rig/eslint/rules/`, export them from `skills/rig/eslint/index.js`, add the equivalent skill-local check to `skills/rig/eslint/lint.js`, and cover both in `src/eslint-rules.test.js`.
