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

### `rig/addon-order`

When both addons are present, order them as `[steering(), repair()]` so steering can augment the final repair retry prompt:

```ts
// Invalid
addons: [repair(), steering()]

// Valid
addons: [steering(), repair()]
```

The rule swaps the entries automatically.

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

### `rig/prefer-p-glob-over-bash-find`

Use `p.glob(pattern)` instead of `p.bash("find DIR -name PATTERN")` for static file discovery. `p.glob` is the idiomatic Rig primitive: it is declarative, avoids shell quoting issues, and can be analyzed statically.

```ts
// Invalid
files: p.bash("find . -name '*.ts'")
files: p.bash("find src -name '*.md'")

// Valid
files: p.glob("**/*.ts")
files: p.glob("src/**/*.md")
```

The rule autofixes simple `find DIR -name PATTERN` commands (no other predicates). Complex commands — those with `-type`, `-not -path`, `| sort`, or multiple predicates — are left unchanged because they express behavior that `p.glob` cannot replicate.

Use `p.bash` when you need shell command output (counts, content, sorting, etc.); use `p.glob` when you want the model to iterate over a list of matching paths.

### `rig/no-invalid-agent-fields`

Unknown or misspelled fields on the `agent()` spec object are silently ignored at runtime. TypeScript does not always catch them due to excess property checking gaps, so this rule flags them explicitly.

Valid fields: `name`, `instructions`, `input`, `output`, `model`, `maxTurns`, `addons`, `agents`, `systemMessage`, `tools`.

```ts
// Invalid — "instructions2" is silently dropped at runtime
agent({ instructions2: p`Review the diff.` })

// Valid
agent({ instructions: p`Review the diff.` })
```

No autofix (the correct field name must be supplied by the author).

### `rig/enum-return-needs-as-const`

A `defineTool` handler that returns a bare string literal widens the return type to `string`, which breaks the enum schema comparison. TypeScript reports the error at the `output` schema, not at the `return` site.

```ts
// Invalid — TypeScript widens "stable" to string
handler: ({ risk }) => {
  return "stable";
}

// Valid — literal type preserved
handler: ({ risk }) => {
  return "stable" as const;
}
```

The rule autofixes by inserting `as const` after the string literal.

## Adding rules

Put rule implementations in `skills/rig/eslint/rules/`, export them from `skills/rig/eslint/index.js`, add the equivalent skill-local check to `skills/rig/eslint/lint.js`, and cover both in `src/eslint-rules.test.js`.
