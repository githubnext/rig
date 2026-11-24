import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const markdown = readFileSync(new URL("../.github/workflows/daily-rig-task-generator.md", import.meta.url), "utf8");
const lock = readFileSync(new URL("../.github/workflows/daily-rig-task-generator.lock.yml", import.meta.url), "utf8");

describe("Daily Rig Task Generator workflow", () => {
  it("installs dependencies on the runner before starting the firewalled agent", () => {
    expect(markdown).toContain("steps:\n  - name: Install dependencies\n    run: npm ci");
    const installation = lock.indexOf("name: Install dependencies");
    const execution = lock.indexOf("name: Execute GitHub Copilot CLI");
    expect(installation).toBeGreaterThan(-1);
    expect(execution).toBeGreaterThan(installation);
    expect(lock.slice(installation, execution)).toContain("run: npm ci");
  });

  it("uses preinstalled dependencies without weakening the agent firewall or TLS", () => {
    const prompt = markdown.slice(markdown.indexOf("\n---\n") + "\n---\n".length);
    expect(prompt).toContain("Do not reinstall them\ninside the agent firewall");
    expect(prompt).not.toContain("npm ci");
    expect(prompt).toContain("npm run sample:check");
    expect(markdown).toContain("allowed: [defaults, github, node]");
    expect(markdown).toContain("strict: true");
    expect(markdown).not.toMatch(/strict-ssl|NODE_TLS_REJECT_UNAUTHORIZED/);
  });
});
