import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { configureAgent, copilotEngine } from "rig";
import haikuAgent from "../src/samples/01-single-agent-haiku.ts";
import sonnetAgent from "../src/samples/56-single-agent-sonnet.ts";
import complexAgent from "../src/samples/57-complex-integration-sonnet.ts";

const token = process.env["COPILOT_GITHUB_TOKEN"];
const sdkUri = process.env["COPILOT_SDK_URI"];
const itWithToken = token || sdkUri ? it : it.skip;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INTEGRATION_TIMEOUT_MS = 120_000;

beforeAll(() => {
  // Use stdio transport when running with a personal token.
  // In agentic workflow context, COPILOT_SDK_URI is provided by the engine
  // and the URI-based connection is used automatically.
  configureAgent(
    copilotEngine({
      workingDirectory: repoRoot,
      ...(token && !sdkUri ? { server: true } : {}),
    }),
  );
});

describe("rig runtime integration", () => {
  itWithToken(
    "runs a single-agent haiku sample with the real runtime",
    async () => {
      const result = await haikuAgent("autumn rain on city windows");
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
      const result = await sonnetAgent("midnight train through fog");
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
      const result = await complexAgent({
        topic: "ship a stable release process",
        audience: "maintainers",
      });

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
