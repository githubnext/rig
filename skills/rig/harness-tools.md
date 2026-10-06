# Harness-owned Rig launch tool

Read when embedding Rig in a trusted Copilot SDK driver without forwarding
connection credentials through the generic shell environment.

## Registration

Import the tool factory from `rig/launch-tool` and register it with the
harness's SDK session:

```ts
import { createRigLaunchTool } from "rig/launch-tool";

const runRig = createRigLaunchTool({
  uri: sdkUri,
  connectionToken,
  cwd: workspacePath,
});

const session = await client.createSession({
  model: "small",
  onPermissionRequest,
  tools: [runRig],
});
```

`sdkUri`, `connectionToken`, `workspacePath`, `client`, and the permission handler
are owned by the host. They are not model-supplied tool arguments.
Permit the `run_rig` custom tool through the host's permission policy.
The model supplies only `{ source: "<complete TypeScript program>" }` and receives
the root's stdout result. Copy provided fixtures unchanged and obey their
one-call/no-retry policy. The host should validate the returned JSON.

The factory accepts optional `launcherPath` and `timeoutMs` (default 180,000).
It starts the current Node executable with `run.ts --connection-fd=3`, sends
source over stdin, and sends `{ uri, connectionToken }` through descriptor 3.
The child environment explicitly excludes `COPILOT_SDK_URI` and
`COPILOT_CONNECTION_TOKEN`. Existing provider configuration and other parent
environment values remain inherited.

Launch errors include stderr and a nonzero exit status; the tool throws
instead of returning success-shaped output. It kills a timed-out subprocess,
limits combined stdout/stderr to 1 MiB, and redacts the connection token from
returned output and errors. Credentials are never written to a file or argv.
See [Launcher details](./launcher-details.md#harness-owned-connection-pipe)
for descriptor validation and connection precedence.

## Trust boundary and Actions integration

This tool executes arbitrary TypeScript with the host's filesystem and
subprocess capabilities. Use it only for trusted source in an appropriately
sandboxed host. It is not a replacement for permission isolation.
The token authenticates access to the sidecar, not a single existing agent
session; Rig creates its own judge sessions.

The built-in gh-aw SDK driver owns `createSession`. Declaring
`tools.run_rig` in workflow YAML does not register this tool.
The driver must explicitly import/register it and receive the harness-owned
connection settings. This repository's integration workflow uses
`engine.driver: .github/drivers/copilot-sdk-driver.ts` to register the tool with
gh-aw's compiler-owned tool filtering and permission handler. That driver
accepts only the exact fixture source from the prompt, enforces one launch,
and writes successful stdout for post-step validation.
Keep the launcher and the program's `"rig"` import on the same runtime copy.
This repository's driver imports the checkout's tool factory and uses its
default launcher; selecting a second installed copy would lose the scoped
connection when the program imports the checkout's runtime.
A custom MCP server also needs an authorized credential
handoff; declaring that server does not give it the token automatically.
Do not work around deliberate credential filtering.

## Live integration test

With the repository's SDK runtime installed and authenticated:

```bash
RIG_TOOL_INTEGRATION=1 npm run test:integration:tool
```

This opt-in test starts a local token-protected sidecar, registers `run_rig`,
asks a real `small` model to launch the unchanged three-judge fixture once,
and checks the workflow's actual post-step assertions. The judges use real
model calls, not stubs. It does not simulate the Actions firewall or modify
the built-in gh-aw driver.

## Pi fixture tool

The [Pi integration](../../.github/workflows/rig-skill-integration-pi.md) selects
`engine.driver: pi_agent_core_driver.cjs`. The managed driver loads the
harness-provisioned Pi SDK through gh-aw's `pi_runtime.cjs` and owns the session.
`engine.config.settings.extensions` explicitly loads the checkout's trusted
`.github/drivers/pi-rig-extension.ts` using an absolute `${{ github.workspace }}`
path. The standard resource loader preserves gh-aw's provider, steering,
Bash/edit policy, tool budgets, MCP, codemode, and JSONL event handling.
It does not replace the SDK session with a bare `pi-agent-core` loop, which
would lose those managed resources and policies.
gh-aw rejects custom driver paths with restricted tools; using the recognized
built-in SDK driver keeps the compiler's restriction checks intact.

The extension calls `pi.registerTool()` with a TypeBox empty-object schema.
The model calls `run_rig({})`; unlike the Copilot source tool, this fixture tool
accepts no source, executable, path, model override, or credential. The host fixes
the checkout launcher and provider fixture, sends `{}` through stdin without a
shell, and forwards only `PATH`, `RIG_JUDGE_ENGINE=pi`, and the managed
`PI_CODING_AGENT_DIR`. The judges read the generated gateway model configuration;
upstream credentials remain in AWF.

One invocation is enforced before asynchronous work, including failed attempts.
The tool supports cancellation, a 180-second timeout, and a 1 MiB limit per
output stream. It removes stale results, validates all three typed judgments,
model selection, and majority verdict, and only then persists stdout for the
independent post-step. Exceptions become failed Pi tool results, not fabricated
success. The workflow reports incomplete and never retries on tool failure.
Registering the extension starts no subprocess; only an explicit tool call does.

This is a trusted, scenario-specific extension inside the existing Actions
firewall, not a general shell grant or a sandbox for arbitrary Rig source.
The checkout's existing `pi-agent-core`/`pi-ai` dependencies type and execute the
judges; the driver resolves the coding-agent SDK already installed by gh-aw
rather than installing another copy from the prompt.

Pinned primary-source contracts used for this integration:

| Source | Relevant contract |
| --- | --- |
| [Pi v1.0.0 SDK](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/sdk.md#configuring-a-session) | Resource-loader extension discovery, SDK MCP/codemode setup, `bindExtensions()`, session disposal |
| [Pi v1.0.0 extensions](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/extensions.md#custom-tools) | `registerTool()`, schema validation, throwing on execution failure, cancellation, default direct exposure |
| [Pi v1.0.0 settings](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/settings.md#resources) | Explicit extension paths, absolute paths supported, agent-directory versus project resource resolution |
| [gh-aw v0.91.2 driver](https://github.com/github/gh-aw/blob/v0.91.2/actions/setup/js/pi_agent_core_driver.cjs) | Managed resource loader and policy extensions, finalized JSONL events |
| [gh-aw v0.91.2 runtime](https://github.com/github/gh-aw/blob/v0.91.2/actions/setup/js/pi_runtime.cjs) | Host/global SDK resolution, managed settings, skills and MCP configuration |
