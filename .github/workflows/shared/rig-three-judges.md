---
runtimes:
  node:
    version: "24"
network:
  allowed: [defaults, github, node]
tools:
  github: false
  edit: false
steps:
  - name: Install checkout dependencies
    run: npm ci
safe-outputs:
  threat-detection: false
  noop:
    report-as-issue: false
post-steps:
  - name: Assert the three-judge integration result
    run: node .github/fixtures/assert-three-judges.ts /tmp/gh-aw/agent/rig-three-judges.json
---

## Required integration procedure

Load the installed `rig` skill and read its `SKILL.md`, `runtime.md`, and
`engines.md` with file-reading tools. This is fixture execution, not code
generation or an environment-diagnosis task.

Run **exactly once**, unchanged:

```bash
printf '%s\n' '{}' | node skills/rig/run.ts .github/fixtures/provider-three-judges.ts > /tmp/gh-aw/agent/rig-three-judges.json
```

Node.js, the provider CLI when needed, and checkout dependencies are already
provisioned. The fixture selects the named Rig adapter explicitly; never replace
it with auto-selection or the Copilot SDK. Do not edit files, create directories,
lint, typecheck, install dependencies, inspect credentials, dump the environment,
change provider configuration, start a server, or retry the command.

The fixture makes exactly three sequential Rig calls: clarity, safety, and
feasibility. Each judge has `maxTurns: 1`. TypeScript owns majority voting;
there is no repair, retry, fourth synthesis call, or task implementation.

If the command fails or is denied, call `report_incomplete` with the exact error
and stop immediately. The one-invocation limit includes denials. Never fabricate
results or call `noop` on failure. On success, call `noop` with a short summary;
the post-step owns result validation and fails on missing or invalid output.
