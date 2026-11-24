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
});
