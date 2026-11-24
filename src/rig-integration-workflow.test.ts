import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/rig-integration.yml", import.meta.url), "utf8");

describe("Rig Integration Tests workflow", () => {
  it("falls back to the workflow token with Copilot request permission", () => {
    expect(workflow).toContain("COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_GITHUB_TOKEN || github.token }}");
    expect(workflow).toContain("copilot-requests: write");
  });

  it("requires live integration rather than silently skipping tests", () => {
    expect(workflow).toContain('RIG_REQUIRE_COPILOT_INTEGRATION: "1"');
    expect(workflow).toContain("run: npm run test:integration");
  });

  it.each([
    "56-single-agent-sonnet.ts",
    "57-complex-integration-sonnet.ts",
  ])("uses a supported Sonnet model in %s", (sample) => {
    const source = readFileSync(new URL(`./samples/${sample}`, import.meta.url), "utf8");
    expect(source).toContain('model: "claude-sonnet-4.6"');
    expect(source).not.toContain('model: "claude-sonnet-4.5"');
  });

  it("keeps launcher diagnostics visible in live integration logs", () => {
    const source = readFileSync(new URL("../scripts/haiku.integration.test.ts", import.meta.url), "utf8");
    expect(source).toContain('stdio: ["pipe", "pipe", "inherit"]');
  });
});
