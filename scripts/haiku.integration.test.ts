import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const token = process.env["COPILOT_GITHUB_TOKEN"];
const itWithToken = token ? it : it.skip;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const haikuSamplePath = resolve(repoRoot, "src/samples/01-single-agent-haiku.ts");
const sonnetSamplePath = resolve(repoRoot, "src/samples/56-single-agent-sonnet.ts");
const complexSamplePath = resolve(repoRoot, "src/samples/57-complex-integration-sonnet.ts");
const launcherPath = resolve(repoRoot, "skills/rig/rig.ts");
const INTEGRATION_TIMEOUT_MS = 120_000;

async function runIntegrationSample(samplePath: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [launcherPath, samplePath, "--server"],
      {
        cwd: repoRoot,
        env: { ...process.env, COPILOT_GITHUB_TOKEN: token },
      },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting for haiku integration run."));
    }, INTEGRATION_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Haiku integration run failed with exit code ${code}.\n${stderr}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.end(input);
  });
}

describe("rig runtime integration", () => {
  itWithToken(
    "runs a single-agent haiku sample with the real runtime",
    async () => {
      const stdout = await runIntegrationSample(haikuSamplePath, "autumn rain on city windows");
      const result = JSON.parse(stdout) as { haiku: string };
      expect(typeof result.haiku).toBe("string");
      const lines = result.haiku
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines).toHaveLength(3);
    },
    INTEGRATION_TIMEOUT_MS,
  );

  itWithToken(
    "runs a single-agent sonnet sample with the real runtime",
    async () => {
      const stdout = await runIntegrationSample(sonnetSamplePath, "midnight train through fog");
      const result = JSON.parse(stdout) as { haiku: string };
      expect(typeof result.haiku).toBe("string");
      const lines = result.haiku
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines).toHaveLength(3);
    },
    INTEGRATION_TIMEOUT_MS,
  );

  itWithToken(
    "runs a complex sonnet sample with tools, addons, intents, and subagent wiring",
    async () => {
      const stdout = await runIntegrationSample(
        complexSamplePath,
        JSON.stringify({
          topic: "ship a stable release process",
          audience: "maintainers",
        }),
      );
      const result = JSON.parse(stdout) as {
        headline: string;
        checklist: string[];
        riskLevel: "low" | "medium" | "high";
        nextActions: Array<{ owner: string; action: string }>;
        contextDigest: {
          repository: string;
          usedFeatures: string[];
          toolHint: string;
        };
      };

      expect(typeof result.headline).toBe("string");
      expect(result.headline.length).toBeGreaterThan(0);
      expect(Array.isArray(result.checklist)).toBe(true);
      expect(result.checklist.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(result.riskLevel);
      expect(Array.isArray(result.nextActions)).toBe(true);
      expect(result.nextActions.length).toBeGreaterThan(0);
      expect(typeof result.contextDigest.repository).toBe("string");
      expect(result.contextDigest.repository.length).toBeGreaterThan(0);
      expect(Array.isArray(result.contextDigest.usedFeatures)).toBe(true);
      expect(result.contextDigest.usedFeatures.length).toBeGreaterThanOrEqual(5);
      expect(typeof result.contextDigest.toolHint).toBe("string");
      expect(result.contextDigest.toolHint.length).toBeGreaterThan(0);
    },
    INTEGRATION_TIMEOUT_MS,
  );
});
