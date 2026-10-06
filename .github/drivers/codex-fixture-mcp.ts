import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertThreeJudges } from "../fixtures/assert-three-judges.ts";

export function createFixtureLauncher(cwd: string, resultPath: string, timeoutMs = 180_000) {
  let launched = false;
  return async (): Promise<unknown> => {
    if (launched) throw new Error("The integration fixture may only be launched once");
    launched = true;
    for (const name of ["SKILL.md", "runtime.md", "engines.md"]) {
      await readFile(join(cwd, ".codex/skills/rig", name), "utf8");
    }
    const env: NodeJS.ProcessEnv = {
      CODEX_API_KEY: "awf-proxy",
      CODEX_HOME: "/tmp/gh-aw/mcp-config",
      GH_AW_MODEL_AGENT_CODEX: "gpt-5.3-codex",
      RIG_JUDGE_ENGINE: "codex",
    };
    for (const name of ["PATH", "HOME", "LANG", "TMPDIR", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]) {
      if (process.env[name] !== undefined) env[name] = process.env[name];
    }
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ["skills/rig/run.ts", ".github/fixtures/provider-three-judges.ts"], {
        cwd, env, stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let bytes = 0;
      let failure: Error | undefined;
      const fail = (error: Error) => {
        failure ??= error;
        child.kill("SIGKILL");
      };
      const timer = setTimeout(() => fail(new Error("Rig fixture timed out")), timeoutMs);
      child.once("error", fail);
      child.stdin.once("error", fail);
      for (const [stream, channel] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
        stream.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) {
            fail(new Error("Rig fixture output exceeds 1 MiB"));
            return;
          }
          if (channel === "stdout") stdout += chunk.toString();
          else stderr += chunk.toString();
        });
      }
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (code !== 0) reject(new Error(`Rig fixture failed (${signal ?? code}): ${stderr}`));
        else resolve(stdout);
      });
      child.stdin.end("{}\n");
    });
    const result: unknown = JSON.parse(output);
    assertThreeJudges(result, "codex");
    await writeFile(resultPath, output, { encoding: "utf8", flag: "wx" });
    console.error("Rig fixture completed: codex, gpt-5.3-codex, three model calls");
    return result;
  };
}

export function createFixtureServer(token: string, launch: () => Promise<unknown>) {
  if (!token) throw new Error("A fixture MCP authentication token is required");
  return createServer(async (request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      response.writeHead(200).end("ok");
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end("Unauthorized");
      return;
    }
    if (request.url !== "/mcp" || request.method !== "POST") {
      response.writeHead(405).end("Use POST /mcp");
      return;
    }
    let id: string | number | null = null;
    const send = (value: object) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id, ...value }));
    };
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 64 * 1024) throw new Error("MCP request exceeds 64 KiB");
      }
      const message: unknown = JSON.parse(body);
      if (!message || typeof message !== "object") throw new Error("Expected a JSON-RPC request");
      const rpc = message as Record<string, unknown>;
      if (rpc["jsonrpc"] !== "2.0") throw new Error("Expected JSON-RPC 2.0");
      if (rpc["id"] === undefined && rpc["method"] === "notifications/initialized") {
        response.writeHead(202).end();
        return;
      }
      if (typeof rpc["id"] !== "string" && typeof rpc["id"] !== "number") throw new Error("Expected a request id");
      id = rpc["id"];
      switch (rpc["method"]) {
        case "initialize":
          send({ result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "rig-codex-fixture", version: "1.0.0" },
          } });
          return;
        case "ping":
          send({ result: {} });
          return;
        case "tools/list":
          send({ result: { tools: [{
            name: "run_rig",
            description: "Read the installed Rig skill and run the checked-in Codex three-judge fixture exactly once. No source, commands, paths, or credentials are accepted.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
          }] } });
          return;
        case "tools/call": {
          const params = rpc["params"];
          if (!params || typeof params !== "object") throw new Error("Expected tool call parameters");
          const call = params as Record<string, unknown>;
          if (call["name"] !== "run_rig") throw new Error("Only run_rig is available");
          const args = call["arguments"];
          if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length)) {
            throw new Error("run_rig accepts no arguments");
          }
          try {
            const result = await launch();
            send({ result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
          } catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            console.error(text);
            send({ result: { isError: true, content: [{ type: "text", text }] } });
          }
          return;
        }
        default:
          send({ error: { code: -32601, message: "Method not found" } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      send({ error: { code: -32602, message } });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = process.env["GITHUB_WORKSPACE"];
  const token = process.env["RIG_FIXTURE_MCP_TOKEN"];
  if (!cwd || !token) throw new Error("GITHUB_WORKSPACE and RIG_FIXTURE_MCP_TOKEN are required");
  const server = createFixtureServer(token, createFixtureLauncher(cwd, "/tmp/gh-aw/agent/rig-three-judges.json"));
  server.on("error", error => {
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(8766, "0.0.0.0", () => console.error("Rig fixture MCP driver listening on port 8766"));
}
