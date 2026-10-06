import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { assertThreeJudges } from "../.github/fixtures/assert-three-judges.ts";
import { piGateway } from "../.github/fixtures/pi-gateway.ts";
import { createPiRigTool } from "../.github/drivers/pi-rig-extension.ts";

const execute = promisify(execFile);
let server: Server | undefined;
let directory: string | undefined;

afterEach(async () => {
  if (server) {
    const closing = new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closing;
    server = undefined;
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

function gateway(baseUrl = "http://api-proxy:10002", api = "openai-completions", model = "gpt-5.3-codex") {
  return {
    providers: {
      "aw-gateway": { baseUrl, api, apiKey: "awf-proxy", models: [{ id: model }] },
    },
  };
}

it.each([
  ["openai-completions", "auto"],
  ["openai-responses", "auto"],
  ["openai-completions", "gpt-5.3-codex"],
  ["openai-responses", "gpt-5.3-codex"],
])("preserves the configured Copilot model using %s for %s", async (api, configuredModel) => {
  const { model, models } = piGateway(gateway(undefined, api, configuredModel));
  expect(model).toBe(configuredModel);
  expect(models.getModel("aw-gateway", configuredModel)).toMatchObject({
    id: configuredModel, api, provider: "aw-gateway", baseUrl: "http://api-proxy:10002",
  });
  expect(await models.getAuth("aw-gateway")).toMatchObject({ auth: { apiKey: "awf-proxy" } });
  expect(models.getProvider("openai")).toBeUndefined();
  expect(models.getProvider("github-copilot")).toBeUndefined();
});

it.each([
  null, {}, { providers: {} },
  gateway("", "openai-completions"),
  gateway(undefined, "anthropic-messages"),
  { providers: { "aw-gateway": { ...gateway().providers["aw-gateway"], apiKey: "real-secret" } } },
  { providers: { "aw-gateway": { ...gateway().providers["aw-gateway"], models: [] } } },
  { providers: { "aw-gateway": { ...gateway().providers["aw-gateway"], models: [{ id: "" }] } } },
  { providers: { "aw-gateway": { ...gateway().providers["aw-gateway"], models: [{ id: "auto", maxTokens: -1 }] } } },
])("rejects missing or invalid gateway configuration without native-provider fallback: %j", value => {
  expect(() => piGateway(value)).toThrow();
});

it.each(["success", "bad-json", "empty-reason", "provider-error"].flatMap(scenario =>
  ["launcher", "extension"].flatMap(launch =>
    ["openai-completions", "openai-responses"].map(api => ({ scenario, launch, api })),
  ),
))(
  "runs the actual Pi fixture through $launch against $api: $scenario",
  async ({ scenario, launch, api }) => {
    const requests: { path: string; authorization: string | undefined; body: Record<string, unknown> }[] = [];
    const judgments = [
      '{"decision":"approve","reason":"Clear and specific."}',
      '{"decision":"approve","reason":"Harmless local change."}',
      '{"decision":"approve","reason":"Practical to implement."}',
    ];
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      requests.push({
        path: request.url ?? "",
        authorization: request.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      });
      if (scenario === "provider-error") {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "Gateway authentication failed" } }));
        return;
      }
      const content = scenario === "bad-json" ? "not JSON"
        : scenario === "empty-reason" ? '{"decision":"approve","reason":" "}'
        : judgments[requests.length - 1];
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (api === "openai-responses") {
        const item = { id: "judge-message", type: "message", role: "assistant", content: [{ type: "output_text", text: content, annotations: [] }] };
        for (const event of [
          { type: "response.created", response: { id: "judge-response", model: "gpt-5.3-codex", status: "in_progress" } },
          { type: "response.output_item.added", output_index: 0, item: { ...item, content: [] } },
          { type: "response.content_part.added", output_index: 0, content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
          { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: content },
          { type: "response.output_item.done", output_index: 0, item },
          { type: "response.completed", response: {
            id: "judge-response", model: "gpt-5.3-codex", status: "completed", output: [item],
            usage: { input_tokens: 12, output_tokens: 12, total_tokens: 24 },
          } },
        ]) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        response.end();
        return;
      }
      response.write(`data: ${JSON.stringify({
        id: "judge-test", object: "chat.completion.chunk", created: 1, model: "gpt-5.3-codex",
        choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
      })}\n\n`);
      response.end(`data: ${JSON.stringify({
        id: "judge-test", object: "chat.completion.chunk", created: 1, model: "gpt-5.3-codex",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24 },
      })}\n\ndata: [DONE]\n\n`);
    });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a local gateway port");
    directory = await mkdtemp(join(tmpdir(), "rig-pi-gateway-test-"));
    await writeFile(join(directory, "models.json"), JSON.stringify(gateway(`http://127.0.0.1:${address.port}`, api)));
    const path = join(directory, "result.json");
    const tool = createPiRigTool({ cwd: process.cwd(), agentDir: directory, outputPath: path });
    const command = launch === "extension" ? tool.execute("fixture", {}).then(result => {
      const content = result.content.find(part => part.type === "text");
      if (!content || content.type !== "text") throw new Error("Expected the fixture tool's JSON output");
      return { stdout: content.text, stderr: "" };
    }) : new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile(process.execPath, [
        "skills/rig/run.ts", ".github/fixtures/provider-three-judges.ts",
      ], {
        env: { PATH: process.env["PATH"], RIG_JUDGE_ENGINE: "pi", PI_CODING_AGENT_DIR: directory },
        timeout: 15_000,
      }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
      child.stdin!.end("{}\n");
    });
    if (scenario === "success") {
      const { stdout } = await command;
      assertThreeJudges(JSON.parse(stdout), "pi");
      expect(requests).toHaveLength(3);
      for (const [index, request] of requests.entries()) {
        expect(request.body["model"]).toBe("gpt-5.3-codex");
        expect(JSON.stringify(request.body[api === "openai-responses" ? "input" : "messages"])).toContain(["clarity", "safety", "feasibility"][index]);
        expect(request.authorization).toBe("Bearer awf-proxy");
        expect(request.path).toBe(api === "openai-responses" ? "/responses" : "/chat/completions");
      }
      if (launch === "extension") {
        expect(await readFile(path, "utf8")).toBe(stdout);
        await expect(tool.execute("retry", {})).rejects.toThrow("only be launched once");
        expect(requests).toHaveLength(3);
      } else await writeFile(path, stdout);
      const assertion = await execute(process.execPath, [".github/fixtures/assert-three-judges.ts", path], {
        env: { RIG_JUDGE_ENGINE: "pi" },
      });
      expect(JSON.parse(assertion.stdout)).toEqual(JSON.parse(stdout));
    } else {
      await expect(command).rejects.toThrow("Missing or invalid clarity judgment");
      expect(requests).toHaveLength(1);
      if (launch === "extension") {
        await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(tool.execute("retry", {})).rejects.toThrow("only be launched once");
        expect(requests).toHaveLength(1);
      }
    }
  },
  20_000,
);
