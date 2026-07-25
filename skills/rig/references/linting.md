# Linting Rig programs

Read this reference when generating or validating Rig TypeScript in the Rig repository.

Run both static checks before executing a generated program:

```bash
npm run lint
npm run typecheck
```

The skill includes a flat ESLint configuration at `skills/rig/eslint.config.js` and local rules under `skills/rig/eslint/`. The repository's root config re-exports it. Add new Rig-specific diagnostics to the skill plugin and enable them in the skill config.

## Record object values

`s.record` accepts one schema describing every map value. Wrap fixed fields in `s.object`:

```ts
s.record(s.object({
  status: s.enum("ok", "warning", "error"),
  message: s.string,
}))
```

Passing fields directly, as in `s.record({ status: s.string })`, is invalid. The `rig/record-object-shape` rule reports and fixes this mistake.
