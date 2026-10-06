import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { CopilotClient, RuntimeConnection } from "@github/copilot-sdk";
import { expect, it } from "vitest";
import { createRigLaunchTool } from "rig/launch-tool";

const liveTest = process.env["RIG_TOOL_INTEGRATION"] === "1" ? it : it.skip;

liveTest("runs the three-judge fixture through a harness-owned tool without credential environment variables", async () => {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const markdown = await readFile(new URL("../.github/workflows/rig-skill-integration.md", import.meta.url), "utf8");
  const source = markdown.match(/```rig\n([\s\S]*?)\n```/)?.[1];
  if (!source) throw new Error("Integration fixture is missing");
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const connectionToken = randomUUID();
  const tool = createRigLaunchTool({ uri: `http://127.0.0.1:${port}`, connectionToken, cwd });
  let toolCalls = 0;
  let output: string | undefined;
  let launchFailure: unknown;
  const client = new CopilotClient({
    connection: RuntimeConnection.forTcp({ port, connectionToken }),
    workingDirectory: cwd,
  });
  try {
    const session = await client.createSession({
      model: "small",
      onPermissionRequest: request => request.kind === "custom-tool" && request.toolName === "run_rig"
        ? { kind: "approve-once" }
        : { kind: "reject", feedback: "Use run_rig only; no shell or file access is required." },
      tools: [{
        ...tool,
        handler: async (args, invocation) => {
          toolCalls++;
          assert.equal(toolCalls, 1, "The fixture must run exactly once");
          assert.equal(args.source.trim(), source.trim(), "Copy the fixture unchanged");
          let result;
          try {
            result = await tool.handler(args, invocation);
          } catch (error) {
            launchFailure = error;
            throw error;
          }
          assert.equal(typeof result, "string");
          output = String(result);
          return result;
        },
      }],
    });
    try {
      await session.sendAndWait({
        prompt: `Call run_rig exactly once with the following source unchanged. Do not use other tools or retry on failure. Report the returned result.\n\n\`\`\`rig\n${source}\n\`\`\``,
      }, 180_000);
      expect(toolCalls).toBe(1);
      if (launchFailure) throw launchFailure;
      expect(output).toBeDefined();
      const result = JSON.parse(output!);
      const assertion = markdown.match(/      node --input-type=module <<'JS'\n([\s\S]*?)      JS/)?.[1];
      if (!assertion) throw new Error("Integration assertion is missing");
      runInNewContext(assertion.replace(/^      /gm, "").replace(/^import .*;\n/gm, ""), {
        assert, readFileSync: () => JSON.stringify(result), console,
      });
      expect(output).not.toContain(connectionToken);
    } finally {
      await session.disconnect();
    }
  } finally {
    await client.stop();
  }
}, 240_000);
