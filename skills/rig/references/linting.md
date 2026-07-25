# Linting Rig programs

Rig exports an ESLint plugin from `rig/eslint`. The repository flat config enables its project rules for TypeScript files.

Run the linter after generating or changing a Rig program:

```bash
npm run lint -- path/to/program.ts
```

Use `--fix` to apply safe fixes:

```bash
npm run lint -- --fix path/to/program.ts
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

Put rule implementations in `skills/rig/eslint/rules/`, export them from `skills/rig/eslint/index.js`, enable them in `eslint.config.js`, and add RuleTester coverage in `src/eslint-rules.test.js`.
