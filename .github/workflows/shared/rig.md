---
runtimes:
  node:
    version: "24"
tools:
  bash: ["printf", "node"]
network:
  allowed: [defaults, github, node]
---

<!--
Rig launcher prerequisites. Import with `imports: [shared/rig.md]` in this
repository or pin `githubnext/rig/.github/workflows/shared/rig.md@<full-commit-sha>`
in another repository. Configure the Rig skill, Copilot SDK engine, and
copilot-requests permission in the consuming workflow.
-->

<rig>
Load the installed `rig` skill and read its Running and engines reference before
creating or running Rig programs.
Run Rig programs with Node.js 24 or later using the installed skill's `run.ts`
launcher and host-provisioned dependencies. Do not install packages from the
agent prompt; report missing dependencies and stop.
When the harness exposes `run_rig`, use it with a `source` argument instead of
Bash. The trusted driver supplies SDK credentials through a private pipe;
do not inspect or forward tokens yourself. Follow the workflow's launch limit.
Otherwise, pipe literal source using
`printf '%s\n' ... | node <skill-dir>/run.ts`, with one single-quoted argument
per line and each literal apostrophe escaped as `'"'"'`. Do not use heredocs
with the Copilot SDK driver. Start the pipeline with `printf`; do not prepend
`mkdir`, `cd`, `env`, or any `&&` preparation.
Use existing output directories; `/tmp/gh-aw/agent` is already provisioned.
Read only named environment variables needed by the program; do not dump the
environment or print credentials.

When launching through Bash with the Copilot SDK engine, inherit `COPILOT_SDK_URI` and
`COPILOT_CONNECTION_TOKEN`; do not start another server or use `--server`.
If a command is denied, report that specific command, not that all shell access
is unavailable. Do not replace a failed run with fabricated output.
</rig>
