# GitHub Agentic Workflows

Read when configuring Rig workflow imports, permissions, dependencies, SDK
credentials, or the checkout integration test. For launching source, read
[Running programs](./runtime.md).

## Configuration

Import the [shared Rig template](../../.github/workflows/shared/rig.md) and pin
both template and skill to an immutable commit:

```yaml
imports:
  - githubnext/rig/.github/workflows/shared/rig.md@<full-commit-sha>
engine:
  id: copilot
  copilot-sdk: true
skills:
  - githubnext/rig/skills/rig/SKILL.md@<full-commit-sha>
permissions:
  copilot-requests: write
tools:
  bash: ["printf", "node"]
```

In this repository, use `imports: [shared/rig.md]`. The template provisions
Node.js 24 and permits both launch stages; it does not install dependencies
or select the skill or engine. Provision dependencies in the host, not from
the agent prompt. Report missing dependencies and stop.

Without the template, configure equivalent prerequisites:

```yaml
runtimes:
  node:
    version: "24"
tools:
  bash: ["printf", "node"]
network:
  allowed: [defaults, github, node]
```

Import `configureAgent` and `copilotEngine` from `"rig"` and call
`configureAgent(copilotEngine())` before defining agents. Launch the installed
skill's `run.ts`. Grant only the additional tools and network access the program
needs. Permitting arbitrary Node code still permits filesystem and subprocess
operations: a smaller command allowlist is not a sandbox boundary.

## SDK connection credential handoff

Pass both `COPILOT_SDK_URI` and `COPILOT_CONNECTION_TOKEN` from the harness
environment to every Node subprocess that launches Rig. Preserve their values
unchanged: inherit the parent environment, or forward both through supported
subprocess-environment configuration when supplying one explicitly.
Do not replace the environment with a map that omits the connection token.
This is environment forwarding, not a shell `env` or `export` command.

`copilotEngine()` reads the token and passes it as
`RuntimeConnection.forUri(uri, { connectionToken })`. The URI alone does not
authenticate to a token-protected sidecar. This token authenticates the SDK
transport; it is not a GitHub or provider API token.
Never print it, embed it in source or shell commands, or write it to files.
If the execution tool cannot forward the required environment, report that
prerequisite instead of attempting an unauthenticated connection.
Do not use `--server` or start another server to work around a failed handoff.
Inspect only named environment variables when permitted; never dump credentials.

For an SDK driver you own, [Harness tools](./harness-tools.md) provides `run_rig`
with an authorized pipe-based handoff instead of credential environment variables.
It requires driver registration; the built-in gh-aw driver does not expose it.
This repository's integration fixture selects `.github/drivers/rig-sdk-driver.ts`
through `engine.driver` to provide that registration.

## Launch failures and validation

Use the literal printf pipeline from [Running programs](./runtime.md), not a
heredoc: gh-aw v0.91.1's SDK permission parser treats heredoc body lines as
commands. If a stage is denied, report the exact command and required grant,
not a missing Node runtime or SDK; do not use a blanket shell grant.
If an unrelated preparation command is denied before launch, remove it rather
than claiming all Bash is unavailable. Respect the workflow's retry policy.
If launch fails, report its exact error without fabricating output.

For an unchanged prevalidated fixture, skip lint/typecheck preflights and
launch once. For newly generated programs, retain the skill's checks.
Use an existing output directory; `/tmp/gh-aw/agent` is already provisioned.
If another required directory is missing, report it instead of adding
disallowed preparation commands.

Edit workflows with an agent or use `gh aw compile --watch` for feedback.
Before committing, run `gh aw compile <workflow-id> --strict` and include the
generated `.lock.yml`.

## Testing the checkout's skill

Declare `skills: [skills/rig]` to install the current checkout instead of a
released commit. The [Rig Skill Integration workflow](../../.github/workflows/rig-skill-integration.md)
does this daily or on manual dispatch.

Its no-input fence runs three `small` judges with `maxTurns: 1`, no repair addon,
and deterministic majority voting. The post-step fails missing output, invalid
judgments, or an unexpected verdict. The outer engine also uses `small` because
its provider configuration determines the model used by SDK sessions.
The three-call count covers the Rig scenario, not the outer engine's turns.
