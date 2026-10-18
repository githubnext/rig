import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
const workflows = readdirSync(workflowsDirectory).filter((name: string) => name.endsWith(".md"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const ghAwVersion = readFileSync(new URL("copilot-setup-steps.yml", workflowsDirectory), "utf8")
  .match(/^\s+version: (v\d+\.\d+\.\d+)$/m)?.[1];

function workflowVersion(name: string): string {
  const source = readFileSync(new URL(name, workflowsDirectory), "utf8");
  const match = source.match(/^engine:\n  id: ([^\n]+)\n  version: "([^"]+)"/m);
  expect(match, `${name} must explicitly pin its engine CLI`).not.toBeNull();
  return match![2]!;
}

it.each(workflows)("keeps %s engine pins and compiled installations synchronized", name => {
  const compiled = readFileSync(new URL(name.replace(/\.md$/, ".lock.yml"), workflowsDirectory), "utf8");
  const metadata = JSON.parse(compiled.split("\n")[0]!.replace("# gh-aw-metadata: ", ""));
  const manifest = JSON.parse(compiled.split("\n")[1]!.replace("# gh-aw-manifest: ", ""));
  const version = workflowVersion(name);
  expect(ghAwVersion).toBeDefined();
  expect(metadata.compiler_version).toBe(ghAwVersion);
  for (const container of manifest.containers) {
    expect(container.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(container.pinned_image).toBe(`${container.image}@${container.digest}`);
  }
  expect(metadata.engine_versions[metadata.agent_id]).toBe(version);
  if (metadata.agent_id === "copilot") {
    expect(version).toBe(workflowVersion("rig-skill-integration.md"));
    expect(compiled).toContain(`install_copilot_cli.sh" ${version}`);
  } else {
    const packages: Record<string, string> = {
      codex: "@openai/codex",
      gemini: "@google/gemini-cli",
      pi: "@earendil-works/pi-coding-agent",
      "deepseek-harness": "@deepseek-ai/dsh",
    };
    expect(packages[metadata.agent_id]).toBeDefined();
    expect(compiled).toContain(`${packages[metadata.agent_id]}@${version}`);
  }
});

it.each([
  ["codex", "@openai/codex-sdk"],
  ["codex", "@openai/codex"],
  ["pi", "@earendil-works/pi-agent-core"],
  ["pi", "@earendil-works/pi-ai"],
  ["deepseek", "@deepseek-ai/dsh-sdk-client"],
])("matches the %s workflow CLI to the locked %s runtime", (engine, packageName) => {
  expect(lock.packages[`node_modules/${packageName}`].version)
    .toBe(workflowVersion(`rig-skill-integration-${engine}.md`));
});

it("keeps the standalone Copilot SDK aligned with the repository SDK", () => {
  const skill = JSON.parse(readFileSync(new URL("../skills/rig/package.json", import.meta.url), "utf8"));
  expect(skill.dependencies["@github/copilot-sdk"])
    .toBe(lock.packages["node_modules/@github/copilot-sdk"].version);
});
