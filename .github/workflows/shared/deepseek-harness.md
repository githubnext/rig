---
engine:
  id: deepseek-harness
  detection-engine: copilot
  version: "0.2.0-rc.2"
  display-name: DeepSeek Harness
  description: DeepSeek Harness headless runtime with reflected AWF provider routing.
  experimental: true
  mcp: false
  provider:
    name: github
  behaviors:
    secret-strategy: universal-llm-consumer
    manifest:
      files: [AGENTS.md, AGENTS.local.md, CLAUDE.md, CLAUDE.local.md]
      path-prefixes: [.dsh/]
    network:
      defaults: [host.docker.internal, github.com, raw.githubusercontent.com, api.github.com, objects.githubusercontent.com]
      provider-domains:
        copilot: api.githubcopilot.com
    installation:
      package-manager: npm
      package-name: "@deepseek-ai/dsh"
      step-name: Install DeepSeek Harness
      binary-name: dsh
      include-node-setup: true
      post-install-scripts: true
      cooldown: false
      verify-command: dsh --version
      verify-step-name: Verify DeepSeek Harness installation
    execution:
      command-name: dsh
      args: [--profile, headless]
      step-name: Execute DeepSeek Harness
      model-env-var: DSH_MODEL
      provider-env-mode: universal-llm-consumer
      write-timestamp: true
      env:
        DSH_PERMISSION_MODE: workspace-write
        DSH_TELEMETRY_DISABLED: "1"
        DSH_TOOLS_MODE: native
        NO_COLOR: "1"
    harness-script: |
      const { createRequire } = require("node:module");
      const { join } = require("node:path");
      const { runDeepSeekHarness } = require(join(process.env.GITHUB_WORKSPACE, ".github/drivers/deepseek-harness.cjs"));
      runDeepSeekHarness({
        reflect: createRequire(__filename)("./awf_reflect.cjs"),
        argv: process.argv.slice(2),
        env: process.env,
      }).catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = error.exitCode || 1;
      });
---

<!--
This repository-scoped engine targets DeepSeek Harness 0.2.0-rc.2. Its trusted
launcher discovers the Copilot gateway through AWF reflection and writes a
home-level Cordis patch, not the legacy settings.yaml. The outer agent runs
inside AWF with workspace-write confinement and no interactive approvals;
the judge subprocesses override that policy with their read-only patch.
DeepSeek's native tools cannot enforce
gh-aw's command allowlist, so the outer runtime is not an allowlist boundary.
MCP is disabled; workflow safe outputs use the generated CLI proxy.
-->
