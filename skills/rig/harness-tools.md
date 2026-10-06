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
