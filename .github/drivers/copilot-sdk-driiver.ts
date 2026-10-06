import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as sdk from "@github/copilot-sdk";
import { createRigLaunchTool } from "../../skills/rig/launch-tool.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const actionRequire = createRequire(join(requiredEnv("RUNNER_TEMP"), "gh-aw/actions/copilot_sdk_driver.cjs"));
  const { parseMultiProviderJson } = actionRequire("./copilot_sdk_multi_provider.cjs");
  const { parseCopilotSDKToolConfig, buildCopilotSDKSessionToolConfig } = actionRequire("./copilot_sdk_tool_config.cjs");
  const { buildCopilotSDKPermissionHandler } = actionRequire("./copilot_sdk_permissions.cjs");
  const provider = parseMultiProviderJson(requiredEnv("GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON"));
  if (!provider) throw new Error("Invalid SDK provider configuration");
  const prompt = await readFile(requiredEnv("GH_AW_PROMPT"), "utf8");
  const source = prompt.match(/```rig\n([\s\S]*?)\n```/)?.[1];
  if (!source) throw new Error("Expected the prevalidated Rig fixture in the workflow prompt");
  const cwd = requiredEnv("GITHUB_WORKSPACE");
  const uri = requiredEnv("COPILOT_SDK_URI");
  const connectionToken = requiredEnv("COPILOT_CONNECTION_TOKEN");
  const toolConfig = parseCopilotSDKToolConfig(requiredEnv("GH_AW_COPILOT_SDK_TOOL_CONFIG"));
  const sessionTools = buildCopilotSDKSessionToolConfig(toolConfig, sdk);
  const permissions = buildCopilotSDKPermissionHandler(toolConfig.permissions, sdk.approveAll, { workspaceRoot: cwd });
  const launchTool = createRigLaunchTool({ uri, connectionToken, cwd });
  let launched = false;
  let launchError: unknown;
  let result: string | undefined;
  const client = new sdk.CopilotClient({
    connection: sdk.RuntimeConnection.forUri(uri, { connectionToken }),
    workingDirectory: cwd,
  });
  try {
    const session = await client.createSession({
      model: provider.model,
      providers: provider.providers,
      models: provider.models,
      availableTools: sessionTools.availableTools.addCustom("run_rig"),
      onPermissionRequest: (request, invocation) => request.kind === "custom-tool" && request.toolName === "run_rig"
        ? sdk.approveAll(request, invocation)
        : permissions(request, invocation),
      tools: [...sessionTools.tools, {
        ...launchTool,
        handler: async (args, invocation) => {
          try {
            if (launched) throw new Error("The integration fixture may only be launched once");
            launched = true;
            if (args.source.trim() !== source.trim()) throw new Error("The integration fixture must be copied unchanged");
            const output = await launchTool.handler(args, invocation);
            if (typeof output !== "string") throw new Error("Expected Rig launcher stdout");
            result = output;
            await writeFile("/tmp/gh-aw/agent/rig-skill-integration.json", output, "utf8");
            return output;
          } catch (error) {
            launchError = error;
            const message = (error instanceof Error ? error.message : String(error)).replaceAll(connectionToken, "[redacted]");
            return { resultType: "failure", textResultForLlm: message, error: message };
          }
        },
      }],
    });
    const directory = join("/tmp/gh-aw/sandbox/agent/logs/copilot-session-state", session.sessionId);
    await mkdir(directory, { recursive: true });
    const eventsPath = join(directory, "events.jsonl");
    let logWrites = Promise.resolve();
    let logError: unknown;
    session.on(event => {
      if (event.ephemeral) return;
      const line = JSON.stringify(event).replaceAll(connectionToken, "[redacted]") + "\n";
      process.stderr.write(line);
      logWrites = logWrites.then(() => appendFile(eventsPath, line)).catch(error => {
        logError = error;
      });
    });
    try {
      const response = await session.sendAndWait({ prompt }, 180_000);
      if (response?.data.content) process.stdout.write(response.data.content + "\n");
      if (launchError) throw launchError;
      if (!result) throw new Error("The agent did not produce a Rig integration result");
    } finally {
      try {
        await session.disconnect();
      } finally {
        await logWrites;
        if (logError) throw logError;
      }
    }
  } finally {
    await client.stop();
  }
}

main().catch((error: unknown) => {
  const token = process.env["COPILOT_CONNECTION_TOKEN"];
  const message = error instanceof Error ? error.message : String(error);
  console.error(token ? message.replaceAll(token, "[redacted]") : message);
  process.exitCode = 1;
});
