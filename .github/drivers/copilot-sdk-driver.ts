import { lstat, readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as sdk from "@microsoft/copilot-sdk";
import { copilotTcpConnection } from "../../skills/rig/rig.ts";
import { createRigLaunchTool } from "../../skills/rig/launch-tool.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const actionRequire = createRequire(join(requiredEnv("RUNNER_TEMP"), "gh-aw/actions/copilot_sdk_driver.cjs"));
  const { parseMultiProviderJson, qualifyModelForMultiProvider } = actionRequire("./copilot_sdk_multi_provider.cjs");
  const { parseCopilotSDKToolConfig, buildCopilotSDKSessionToolConfig, loadCopilotSDKMCPServers } = actionRequire("./copilot_sdk_tool_config.cjs");
  const { buildCopilotSDKPermissionHandler, getEnvPositiveIntOrDefault, MAX_TOOL_DENIALS_DEFAULT } = actionRequire("./copilot_sdk_permissions.cjs");
  const { buildCopilotSDKToolCallBudget } = actionRequire("./copilot_sdk_tool_budget.cjs");
  const { createCopilotSDKModelObserver, COPILOT_MODEL_VERIFICATION_EXIT_CODE } = actionRequire("./copilot_model_selection.cjs");
  const { getCopilotMessageRefusal } = actionRequire("./copilot_session.cjs");
  const { COPILOT_WORKFLOW_EVENT_TYPES } = actionRequire("./copilot_workflow_events.cjs");
  const { isCopilotSDKBareMode, resolveCopilotSDKWorkingDirectory } = actionRequire("./copilot_sdk_session.cjs");
  const { resolveModelWithFallback } = actionRequire("./model_fallback.cjs");
  const { resolveRoutingReasoningEffort } = actionRequire("./copilot_routing_effort.cjs");
  const fixture = process.env["RIG_WORKFLOW_FIXTURE"] === "1";
  const sourceTool = process.env["RIG_WORKFLOW_SOURCE_TOOL"] === "1";
  const provider = parseMultiProviderJson(requiredEnv("GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON"));
  if (!provider) throw new Error("Invalid SDK provider configuration");
  const requestedModel = process.env["GH_AW_MODEL_ROUTING"] === "1"
    ? process.env["COPILOT_MODEL"]
    : resolveModelWithFallback(process.env, "COPILOT_MODEL");
  const model = qualifyModelForMultiProvider((!fixture && requestedModel) || provider.model, provider);
  if (!model) throw new Error("The requested Copilot model is absent from the workflow provider catalog");
  const prompt = await readFile(requiredEnv("GH_AW_PROMPT"), "utf8");
  const source = fixture ? prompt.match(/```rig\n([\s\S]*?)\n```/)?.[1] : undefined;
  if (fixture && !source) throw new Error("Expected the prevalidated Rig fixture in the workflow prompt");
  const cwd = fixture || sourceTool ? requiredEnv("GITHUB_WORKSPACE") : resolveCopilotSDKWorkingDirectory();
  const uri = requiredEnv("COPILOT_SDK_URI");
  const connectionToken = requiredEnv("COPILOT_CONNECTION_TOKEN");
  const redact = (text: string) => text.replaceAll(connectionToken, "[redacted]");
  const stateDirectory = "/tmp/gh-aw/sandbox/agent/logs/copilot-session-state";
  const skillsDirectory = "/tmp/gh-aw/.github/skills";
  const skillsStat = await lstat(skillsDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (skillsStat && !skillsStat.isDirectory()) throw new Error("Staged Copilot skills must be a directory");

  let rejectSession!: (error: unknown) => void;
  let sessionFailure: unknown;
  const failure = new Promise<never>((_, reject) => { rejectSession = reject; });
  function failSession(error: unknown) {
    sessionFailure ??= error;
    rejectSession(error);
  }
  void failure.catch(() => {}); // A callback can fail before sendAndWait starts.
  let logWrites = Promise.resolve();
  let eventsPath: string | undefined;
  function logEvent(event: object) {
    const line = redact(JSON.stringify(event)) + "\n";
    process.stderr.write(line);
    if (eventsPath) {
      const path = eventsPath;
      logWrites = logWrites.then(() => appendFile(path, line)).catch(failSession);
    }
  }
  const toolConfig = parseCopilotSDKToolConfig(requiredEnv("GH_AW_COPILOT_SDK_TOOL_CONFIG"));
  const sessionTools = buildCopilotSDKSessionToolConfig(toolConfig, sdk);
  const limit = getEnvPositiveIntOrDefault("GH_AW_MAX_TOOL_DENIALS", MAX_TOOL_DENIALS_DEFAULT);
  let denied = 0;
  const permissions = buildCopilotSDKPermissionHandler(toolConfig.permissions, sdk.approveAll, {
    workspaceRoot: cwd,
    onDenied: () => {
      if (++denied !== limit) return;
      logEvent({ type: "guard.tool_denials_exceeded", data: { denialCount: denied, threshold: limit } });
      failSession(new Error(`Max tool denials threshold reached (${limit})`));
    },
  });
  const toolBudget = buildCopilotSDKToolCallBudget(toolConfig.maxToolCalls, (data: { exhausted: boolean }) => {
    logEvent({ type: data.exhausted ? "guard.tool_call_budget_exceeded" : "guard.tool_call_budget_debit", data });
  });
  const servers = loadCopilotSDKMCPServers(toolConfig);
  const reasoningEffort = resolveRoutingReasoningEffort(process.env);
  const observer = createCopilotSDKModelObserver({
    configuredModel: process.env["GH_AW_COPILOT_CONFIGURED_MODEL"] || "",
    expectedModel: model,
    providerConfig: provider,
    sessionDirs: [stateDirectory],
  });
  function failModelVerification(message: string) {
    process.exitCode = COPILOT_MODEL_VERIFICATION_EXIT_CODE;
    failSession(new Error(message));
  }
  const launchTool = createRigLaunchTool({
    uri,
    connectionToken,
    cwd,
    ...(sourceTool && { timeoutMs: 8 * 60 * 1000, includeStderr: true }),
  });
  let launched = false;
  const sourceVersions = new Set<string>();
  let sourceLaunches = 0;
  let launchError: unknown;
  let result: string | undefined;
  const launch: typeof launchTool.handler = async (args, invocation) => {
    try {
      if (fixture) {
        if (launched) throw new Error("The integration fixture may only be launched once");
        launched = true;
        if (!source || args.source.trim() !== source.trim()) throw new Error("The integration fixture must be copied unchanged");
      } else if (sourceTool) {
        if (++sourceLaunches > 2) throw new Error("Rig source launch limit exceeded (2)");
        if (Buffer.byteLength(args.source, "utf8") > 16 * 1024) throw new Error("Rig source exceeds 16 KiB");
        sourceVersions.add(args.source);
        if (sourceVersions.size > 2) throw new Error("Rig source attempt limit exceeded (2)");
      } else {
        throw new Error("Rig source launch tool is not enabled for this workflow");
      }
      const output = await launchTool.handler(args, invocation);
      if (typeof output !== "string") throw new Error("Expected Rig launcher stdout");
      if (fixture) {
        result = output;
        await writeFile("/tmp/gh-aw/agent/rig-skill-integration.json", output, "utf8");
      }
      return output;
    } catch (error) {
      if (fixture) launchError = error;
      const message = redact(error instanceof Error ? error.message : String(error));
      return { resultType: "failure", textResultForLlm: message, error: message };
    }
  };
  const client = new sdk.CopilotClient({
    mode: "coding-agent",
    runtime: copilotTcpConnection(uri, connectionToken),
  });
  try {
    const session = await client.createSession({
      model,
      workingDirectory: cwd,
      inference: { providers: provider.providers, models: provider.models, ...(reasoningEffort && { reasoningEffort }) },
      enableConfigDiscovery: false,
      instructions: { skipCustomInstructions: isCopilotSDKBareMode(process.env["GH_AW_COPILOT_SDK_SERVER_ARGS"]) },
      ...(skillsStat && { skills: { directories: [skillsDirectory], enabled: true } }),
      ...(servers && { mcp: { servers } }),
      ...(toolBudget && { hooks: { handlers: { onPreToolUse: toolBudget.onPreToolUse } } }),
      permissions: {
        onRequest: (request, invocation) => (fixture || sourceTool) && request.kind === "custom-tool" && request.toolName === "run_rig"
          ? sdk.approveAll(request, invocation)
          : permissions(request, invocation),
      },
      tools: {
        availableTools: fixture || sourceTool ? sessionTools.availableTools.addCustom("run_rig") : sessionTools.availableTools,
        definitions: fixture || sourceTool ? [...sessionTools.definitions, { ...launchTool, handler: launch }] : sessionTools.definitions,
      },
    });
    try {
      const directory = join(stateDirectory, session.sessionId);
      await mkdir(directory, { recursive: true });
      eventsPath = join(directory, "events.jsonl");
      observer.setSessionId(session.sessionId);
      const capturedEphemeral = new Set([...COPILOT_WORKFLOW_EVENT_TYPES, "assistant.usage", "model.call_failure", "model.call_final_result"]);
      session.on(event => {
        const diagnostic = observer.observe(event);
        if (diagnostic) failModelVerification(diagnostic);
        if (event.type === "tool.shell_output" || (event.ephemeral && !capturedEphemeral.has(event.type))) return;
        logEvent(event);
      });
      const timeout: number = getEnvPositiveIntOrDefault("COPILOT_SDK_SEND_TIMEOUT_MS", fixture ? 180_000 : 600_000);
      const response = await Promise.race([session.sendAndWait({ prompt }, timeout), failure]);
      if (response && getCopilotMessageRefusal(response.data)?.reason === "content_filter") {
        throw new Error("Copilot response blocked by content filtering");
      }
      if (launchError) throw launchError;
      if (fixture && !result) throw new Error("The agent did not produce a Rig integration result");
      if (response?.data.content) process.stdout.write(redact(response.data.content) + "\n");
    } finally {
      try {
        await session.disconnect();
      } finally {
        await logWrites;
        const diagnostic = observer.finalize(session.sessionId);
        if (diagnostic) failModelVerification(diagnostic);
        if (sessionFailure) throw sessionFailure;
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
  process.exitCode ||= 1;
});
