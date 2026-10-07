import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { runWorkflow } from "rig";
import { createProviderFixture } from "../.github/fixtures/provider-fixture.ts";
import { assertThreeJudges } from "../.github/fixtures/assert-three-judges.ts";

const { runDeepSeekHarness } = createRequire(import.meta.url)("../.github/drivers/deepseek-harness.cjs");

afterEach(() => {
  vi.unstubAllEnvs();
});

it("runs exactly three real Harness SDK requests through an inherited Copilot gateway route", async () => {
  const requests: { model: string; messages: { content: unknown }[] }[] = [];
  const authorization: (string | undefined)[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    authorization.push(request.headers.authorization);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const envelope = {
      id: "mock-completion",
      object: "chat.completion.chunk",
      created: 1,
      model: "gpt-5.3-codex",
    };
    response.write(`data: ${JSON.stringify({
      ...envelope,
      choices: [{ index: 0, delta: { role: "assistant", content: '{"decision":"approve","reason":"Harmless and practical."}' }, finish_reason: null }],
    })}\n\n`);
    response.write(`data: ${JSON.stringify({
      ...envelope,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    })}\n\n`);
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  const baseURL = `http://127.0.0.1:${address.port}/v1`;
  const directory = await mkdtemp(join(tmpdir(), "rig-deepseek-judges-"));
  try {
    const prompt = join(directory, "prompt.txt");
    await writeFile(prompt, "three-judge fixture");
    const reflect = {
      fetchAWFReflect: vi.fn(async () => ({
        ok: true,
        reflectData: { endpoints: [{ provider: "copilot", configured: true, models_url: `${baseURL}/models` }] },
      })),
      resolveProviderEndpointFromReflect: vi.fn(() => ({ baseUrl: baseURL, endpointProvider: "copilot" })),
      deriveBaseUrlFromModelsURL: vi.fn(() => baseURL),
    };
    const spawn = vi.fn(() => ({ status: 0 }));
    await runDeepSeekHarness({
      reflect,
      argv: ["dsh", "--profile", "headless"],
      env: {
        GITHUB_WORKSPACE: directory,
        DSH_MODEL: "copilot/gpt-5.3-codex",
        GH_AW_LLM_PROVIDER: "github",
        AWF_REFLECT_ENABLED: "1",
        GH_AW_PROMPT: prompt,
        OPENAI_API_KEY: "must-not-enter-config",
      },
      spawn,
    });
    expect(spawn).toHaveBeenCalledWith("dsh", ["--profile", "headless", "three-judge fixture"], expect.objectContaining({
      env: expect.objectContaining({ OPENAI_API_KEY: "awf-proxy", DSH_HOME: join(directory, ".dsh") }),
    }));
    const patch = await readFile(join(directory, ".dsh/cordis.patch.yml"), "utf8");
    expect(patch).not.toContain("must-not-enter-config");
    expect(patch).toContain('"maxRetries": 0');
    expect(reflect.resolveProviderEndpointFromReflect).toHaveBeenCalledWith(expect.objectContaining({
      provider: "github",
    }));
    vi.stubEnv("RIG_JUDGE_ENGINE", "deepseek");
    vi.stubEnv("DSH_MODEL", "copilot/gpt-5.3-codex");
    vi.stubEnv("RIG_JUDGE_MODEL", "copilot/gpt-5.3-codex");
    const { scrubbedParentEnv } = await import("@deepseek-ai/dsh-subprocess");
    const shellEnv = scrubbedParentEnv();
    expect(shellEnv["DSH_MODEL"]).toBeUndefined();
    expect(shellEnv["RIG_JUDGE_ENGINE"]).toBe("deepseek");
    expect(shellEnv["RIG_JUDGE_MODEL"]).toBe("copilot/gpt-5.3-codex");
    vi.stubEnv("DSH_MODEL", "");
    vi.stubEnv("DSH_HOME", join(directory, ".dsh"));
    vi.stubEnv("GITHUB_WORKSPACE", process.cwd());
    const result = await runWorkflow(createProviderFixture());

    assertThreeJudges(result, "deepseek");
    expect(requests).toHaveLength(3);
    expect(authorization).toEqual(["Bearer awf-proxy", "Bearer awf-proxy", "Bearer awf-proxy"]);
    for (const [index, request] of requests.entries()) {
      expect(request.model).toBe("gpt-5.3-codex");
      expect(JSON.stringify(request.messages)).toContain(["clarity", "safety", "feasibility"][index]);
    }
  } finally {
    await rm(directory, { recursive: true });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}, 60_000);

it("rejects missing or invalid AWF reflection before launching the outer agent", async () => {
  const env = {
    GITHUB_WORKSPACE: "/workspace",
    DSH_MODEL: "copilot/gpt-5.3-codex",
    GH_AW_LLM_PROVIDER: "copilot",
    AWF_REFLECT_ENABLED: "1",
  };
  const spawn = vi.fn();
  const reflect = {
    fetchAWFReflect: vi.fn(async () => ({ ok: false, reason: "unavailable" })),
    resolveProviderEndpointFromReflect: vi.fn(),
    deriveBaseUrlFromModelsURL: vi.fn(),
  };

  await expect(runDeepSeekHarness({ env: { ...env, AWF_REFLECT_ENABLED: "0" }, argv: ["dsh"], reflect, spawn }))
    .rejects.toThrow("requires AWF /reflect");
  await expect(runDeepSeekHarness({ env, argv: ["dsh"], reflect, spawn })).rejects.toThrow("unavailable");
  reflect.fetchAWFReflect.mockResolvedValueOnce({
    ok: true,
    reason: "",
  });
  await expect(runDeepSeekHarness({ env, argv: ["dsh"], reflect, spawn })).rejects.toThrow("empty /reflect response");
  expect(spawn).not.toHaveBeenCalled();
});

it.each([
  { provider: "copilot", configured: false, modelsURL: "http://gateway/v1/models" },
  { provider: "openai", configured: true, modelsURL: "http://gateway/v1/models" },
  { provider: "copilot", configured: true, modelsURL: undefined },
  { provider: "copilot", configured: true, modelsURL: "http://gateway/v1/chat/completions" },
  { provider: "copilot", configured: true, modelsURL: "file:///v1/models" },
])("rejects unconfigured or invalid gateway routes: $provider $configured $modelsURL", async ({ provider, configured, modelsURL }) => {
  const spawn = vi.fn();
  const reflect = {
    fetchAWFReflect: vi.fn(async () => ({
      ok: true,
      reflectData: { endpoints: [{ provider, configured, models_url: modelsURL }] },
    })),
    resolveProviderEndpointFromReflect: vi.fn(() => ({ baseUrl: "http://gateway", endpointProvider: provider })),
    deriveBaseUrlFromModelsURL: vi.fn(),
  };
  await expect(runDeepSeekHarness({
    reflect,
    argv: ["dsh"],
    env: {
      GITHUB_WORKSPACE: "/workspace",
      DSH_MODEL: "copilot/gpt-5.3-codex",
      GH_AW_LLM_PROVIDER: "github",
      AWF_REFLECT_ENABLED: "1",
    },
    spawn,
  })).rejects.toThrow(/Copilot \/reflect/);
  expect(spawn).not.toHaveBeenCalled();
  expect(reflect.deriveBaseUrlFromModelsURL).not.toHaveBeenCalled();
});

it.each([7, null, new Error("unable to spawn")])("preserves child process failures: %s", async failure => {
  const directory = await mkdtemp(join(tmpdir(), "rig-deepseek-driver-"));
  try {
    const prompt = join(directory, "prompt.txt");
    await writeFile(prompt, "fixture prompt");
    const reflect = {
      fetchAWFReflect: vi.fn(async () => ({
        ok: true,
        reflectData: { endpoints: [{ provider: "copilot", configured: true, models_url: "http://gateway/v1/models" }] },
      })),
      resolveProviderEndpointFromReflect: vi.fn(() => ({ baseUrl: "http://gateway", endpointProvider: "copilot" })),
      deriveBaseUrlFromModelsURL: vi.fn(() => "http://gateway/v1"),
    };
    const launch = runDeepSeekHarness({
      reflect,
      argv: ["dsh", "--profile", "headless"],
      env: {
        GITHUB_WORKSPACE: directory,
        DSH_MODEL: "copilot/gpt-5.3-codex",
        GH_AW_LLM_PROVIDER: "copilot",
        AWF_REFLECT_ENABLED: "1",
        GH_AW_PROMPT: prompt,
      },
      spawn: vi.fn(() => failure instanceof Error ? { error: failure } : { status: failure }),
    });
    if (failure instanceof Error) await expect(launch).rejects.toBe(failure);
    else await expect(launch).rejects.toMatchObject({ exitCode: failure ?? 1 });
  } finally {
    await rm(directory, { recursive: true });
  }
});
