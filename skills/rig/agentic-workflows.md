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
This repository's integration fixture selects `.github/drivers/copilot-sdk-driver.ts`
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

### Other provider adapters

Four additional daily/manual workflows share the same judge rubric, typed
outputs, majority vote, and strict post-step assertions:

| Workflow | Outer engine / Rig adapter | Model / authentication |
| --- | --- | --- |
| [Codex](../../.github/workflows/rig-skill-integration-codex.md) | Codex CLI / `codexEngine` | `copilot/gpt-5.3-codex`; `copilot-requests: write` |
| [DeepSeek Harness](../../.github/workflows/rig-skill-integration-deepseek.md) | DeepSeek Harness headless / `deepseekEngine` | `copilot/gpt-5.3-codex`; `copilot-requests: write` |
| [Gemini](../../.github/workflows/rig-skill-integration-gemini.md) | Gemini CLI / `geminiEngine` | `gemini-2.5-flash`; repository secret `GEMINI_API_KEY` |
| [Pi](../../.github/workflows/rig-skill-integration-pi.md) | Pi managed SDK driver / `piEngine` | `copilot/gpt-5.3-codex`; `copilot-requests: write` |

The [shared procedure](../../.github/workflows/shared/rig-three-judges.md)
provisions Node.js 24 and checkout dependencies. Gemini and DeepSeek launch a
checked-in fixture once through Bash with `{}` on stdin; file-mode launch still requires
input even when the workflow has no arguments. Codex exposes a fixture-only
`rig-fixture.run_rig` MCP tool. Pi registers a fixed-fixture `run_rig` extension
through `engine.driver` instead of Bash; see
[Pi fixture tool](./harness-tools.md#pi-fixture-tool).
Each variant configures its adapter
explicitly instead of relying on credential-based engine auto-selection.
Claude/Anthropic is not included.

AWF owns upstream credentials. Codex inherits the harness's proxy configuration
and preserves its selector, `CODEX_HOME`, `gpt-5.3-codex` model, and non-secret
`awf-proxy` API-key placeholder through `shell_environment_policy.set`.
Pi uses the generated `PI_CODING_AGENT_DIR/models.json` gateway provider with
that same non-secret placeholder; it does not use native Copilot OAuth or
an OpenAI key. Its outer engine and judges pin `gpt-5.3-codex` to keep the
integration model deterministic rather than using gh-aw's `auto` routing.
Gemini inherits the provisioned CLI, model, and
`GEMINI_API_BASE_URL`. Do not print or copy upstream secrets into fixture source.

DeepSeek uses a [repository-scoped engine definition](../../.github/workflows/shared/deepseek-harness.md)
and [trusted launcher](../../.github/drivers/deepseek-harness.cjs). Both the outer
CLI and Rig SDK runtime pin Harness 0.2.0-rc.2. The launcher discovers the
configured Copilot endpoint through AWF `/reflect`, preserves its API path, and
writes the `awf-proxy` route to `$DSH_HOME/cordis.patch.yml`; the obsolete
`settings.yaml` path is not used. SDK judges inherit that home and use only the
non-secret `awf-proxy` key. Provider retries are disabled. The
fixture uses `RIG_JUDGE_MODEL` because native shell calls discard inherited
`DSH_*` values and rebuild only managed facts, including `DSH_HOME`. The
[judge patch](../../.github/fixtures/deepseek-judges.patch.yml) sets a read-only
file policy and noninteractive denial of operations requiring approval.
DeepSeek has no native MCP support in this integration; safe outputs use the
generated CLI proxy. Its native Bash tool does not enforce gh-aw's command
allowlist. The outer agent uses workspace-write confinement inside AWF with
noninteractive approval policy, not unrestricted file access. It declares
`bash: ["*"]` explicitly because gh-aw 0.91.5 rejects unsupported command
allowlists; the fixed fixture pipeline is a procedure, not an additional
sandbox boundary.

Codex pins a model that supports the Responses API; Copilot rejects `auto`
on that endpoint before the outer engine can invoke Rig.
Compilation and stub/local-gateway tests do not establish live compatibility.
The Copilot compatibility adapter disables Codex's native shell tool. Its
workflow therefore declares `bash: false` and exposes only the fixture-specific
`rig-fixture.run_rig` MCP tool through a trusted HTTP driver on the runner.
The driver accepts no source, commands, paths, or credentials; it reads the
installed skill, launches the checked-in fixture once with an allowlisted
environment and the non-secret proxy key, validates stdout, and persists it
for the independent post-step. The runner-side driver launches the fixed child
inside AWF's existing agent container, drops to the runner's UID/GID, and clears
the child environment; it never enables Codex's model-facing exec tool.
The child has its own timeout because terminating a Docker client does not
terminate the container-side process. Failed calls cannot be retried. Gemini and Pi
continue to permit only `printf` and `node`.
Codex judges disable the inherited fixture-launch and safe-output MCP servers
so only the outer agent can orchestrate the launch and report completion.
Pi's command parser rejects the fixture pipeline's quoting and redirection;
the trusted extension avoids shell parsing without widening the allowlist.
These smoke tests create no repository changes and disable AI threat analysis
of safe outputs; the agent job remains read-only and the post-step validates
the persisted result independently.
