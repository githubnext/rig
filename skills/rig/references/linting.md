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

### `rig/no-object-literal-record`

An `s.record` or `s.nonEmptyObject` value must be a schema. Wrap object fields with `s.object`:

```ts
// Invalid
s.record({ status: s.string })

// Valid
s.record(s.object({ status: s.string }))
```

The rule fixes the invalid form automatically.

## Adding rules

Put rule implementations in `skills/rig/eslint/rules/`, export them from `skills/rig/eslint/index.js`, add the equivalent skill-local check to `skills/rig/eslint/lint.js`, and cover both in `src/eslint-rules.test.js`.
