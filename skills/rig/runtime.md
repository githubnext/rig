# Running programs

Read this reference to launch or typecheck a Rig program. Node.js 24+ and the
skill's SDK dependencies must already be installed.

## Inline programs

Pass a runnable `rig` fence to the launcher without its markdown markers:

```bash
printf '%s\n' \
  '// Agent role: summarize this repository in one sentence.' \
  'export default "Summarize this repository in one sentence.";' \
  | node skills/rig/run.ts
```

Use one single-quoted argument per source line, including `''` for blank lines.
Escape literal apostrophes as `'"'"'`: `const label = "don't";` becomes
`'const label = "don'"'"'t";'`. Keep `'%s\n'` as the fixed format, never source.
This preserves percent signs, backslashes, dollar signs, and backticks.
Do not double-quote source, expand variables, encode it, or use substitutions.
Copy a supplied fixture unchanged.

Export one root: an agent, workflow, string, or prompt builder. Do not invoke
it or print its result in the program; the launcher runs it and writes stdout.
Prefer an explicit default export. See [Launcher details](./launcher-details.md)
for implicit imports, input defaults, fallback roots, and heredoc alternatives.

## Program files

```bash
printf '%s\n' 'Review this diff' | node skills/rig/run.ts src/program.ts
```

For file-mode stdin, `s.string` receives raw text; an object containing `text`
receives `{ text: "<stdin>" }`; other schemas require valid JSON.
String results and an object's string `text` field are written directly;
other results are JSON-serialized.

Both modes run inside a workflow context: top-level `phase()`, `log()`, and
`currentWorkflow()` work, and a workflow root nests into that run.

## Installed skill

Install with `gh skill install githubnext/rig rig`; inspect with `gh skill list`.
Replace `skills/rig` in launch commands with the installed directory.
`run.ts` does not install packages or change the working directory.
Skill installation copies files, not SDK dependencies. Report missing
dependencies and stop; do not install them from an agent prompt.
`rig.ts` also remains a direct runtime entry point.

## Typechecking

For newly generated programs, lint and typecheck before launching:

```bash
node skills/rig/eslint/lint.js program.ts
node skills/rig/run.ts --typecheck < program.ts
node skills/rig/run.ts src/program.ts --typecheck
```

For an unchanged, prevalidated fixture, skip lint and typecheck preflights.
`--typecheck` requires preinstalled `typescript`, makes no model calls, and
exits after printing `typecheck passed` or reporting diagnostics.

## GitHub Agentic Workflows

Import the [shared Rig template](../../.github/workflows/shared/rig.md) or grant
`bash: ["printf", "node"]` and provision Node.js 24 plus dependencies.
Use `configureAgent(copilotEngine())` before defining agents.
Start the pipeline with `printf`: no `mkdir`, `cd`, `env`, `export`, package
manager, or `&&` preparation. Use file-reading tools to load documentation.
`/tmp/gh-aw/agent` is already provisioned; redirect only to existing directories.
Do not use heredocs with the SDK driver: gh-aw v0.91.1's permission parser treats heredoc
body lines as commands. Use the printf pipeline instead, not a heredoc or a blanket shell grant.

Pass both `COPILOT_SDK_URI` and `COPILOT_CONNECTION_TOKEN` unchanged to Node.
Do not replace the environment with a map that omits the connection token.
`copilotEngine()` uses `RuntimeConnection.forUri(uri, { connectionToken })`;
the URI alone does not authenticate to a token-protected sidecar.
Never print the token, embed it in source or shell commands, or write it to files.
If the tool cannot forward the required environment, report the prerequisite
and stop. Do not start another server or use `--server` as a workaround.
Report exact launch errors or denied commands and obey the workflow's retry
policy; a denied command does not mean all Bash or Node execution is unavailable.

## Engine selection

Without `configureAgent(...)`, Rig selects Copilot when `COPILOT_SDK_URI` is set,
then an explicit `RIG_ENGINE`, then a supported provider API-key variable;
otherwise it uses Copilot at `localhost:7777`.
Outside Agentic Workflows, `--server` starts Copilot over stdio and forces that
engine. Other providers require their own supported model IDs; `small` is not
a portable model identifier.

## Focused references

- [Launcher details](./launcher-details.md) — read for heredocs outside the SDK driver, inline input defaults, ESM behavior, or launcher edge cases.
- [Harness tools](./harness-tools.md) — read when registering a trusted `run_rig` SDK tool with pipe-based credentials instead of a shell environment.
- [Agentic Workflows](./agentic-workflows.md) — read when configuring imports, permissions, dependencies, SDK credentials, or the integration fixture.
- [Engines](./engines.md) — read when selecting or configuring an adapter, tools, structured output, provider models, or lifecycle behavior.
- [Debug logging](./debugging.md) — read when diagnosing launch, agent, workflow, or engine failures with `RIG_DEBUG`.
