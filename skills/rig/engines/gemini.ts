import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { debug } from "../rig.ts";
import type { AgentFactory } from "../rig.ts";
import { agentLifecycle } from "./utils.ts";

const debugCreate = debug("engine:gemini:create");
const debugAsk = debug("engine:gemini:ask");
const debugResponse = debug("engine:gemini:response");
const debugClose = debug("engine:gemini:close");

export type GeminiEngineOptions = {
  command?: string;
  cwd?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  approvalMode?: "default" | "auto_edit" | "yolo" | "plan";
};

type GeminiOutput = {
  session_id?: string;
} & ({
  response: string;
  error?: undefined;
} | {
  response?: string;
  error: { message?: string };
});

export function geminiEngine(options: GeminiEngineOptions = {}): AgentFactory {
  const {
    command = "gemini",
    cwd,
    args: extraArgs = [],
    env,
    approvalMode,
  } = options;

  return (agentOptions) => {
    if (agentOptions.tools && agentOptions.tools.length > 0) {
      throw new Error("geminiEngine does not support Rig tools");
    }
    debugCreate({ model: agentOptions.model, command, ...(cwd !== undefined && { cwd }) });
    const systemMessage = stringSystemMessage(agentOptions.systemMessage);
    const lifecycle = agentLifecycle("geminiEngine");
    let sessionId: string | undefined;

    return {
      ask(prompt, askOptions = {}) {
        return lifecycle.run(askOptions.signal, async (signal) => {
          debugAsk({ model: agentOptions.model, prompt, resumed: sessionId !== undefined });
          const nextSessionId = sessionId ?? randomUUID();
          const fullPrompt = sessionId === undefined && systemMessage
            ? `${systemMessage}\n\n${prompt}`
            : prompt;
          const cliArgs = [
            ...extraArgs,
            "--model",
            agentOptions.model,
            "--output-format",
            "json",
            ...(approvalMode ? ["--approval-mode", approvalMode] : []),
            ...(sessionId ? ["--resume", sessionId] : ["--session-id", nextSessionId]),
            "--prompt",
            fullPrompt,
          ];
          const output = await runGemini(command, cliArgs, {
            ...(cwd !== undefined && { cwd }),
            env: { ...process.env, ...env },
            signal,
          });
          signal.throwIfAborted();
          if (output.error !== undefined) {
            throw new Error(output.error.message ?? "Gemini CLI request failed");
          }
          sessionId = output.session_id ?? nextSessionId;
          const text = output.response;
          debugResponse({ model: agentOptions.model, session: sessionId, response: text });
          return text;
        });
      },
      async close() {
        debugClose({ model: agentOptions.model, session: sessionId });
        await lifecycle.close();
      },
    };
  };
}

function runGemini(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env: NodeJS.ProcessEnv;
    signal: AbortSignal;
  },
): Promise<GeminiOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal,
    });
    let stdout = "";
    let stderr = "";
    let processError: unknown;
    let killTimer: NodeJS.Timeout | undefined;
    const forceKill = () => {
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      killTimer.unref();
    };
    options.signal.addEventListener("abort", forceKill, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      processError = error;
    });
    child.once("close", (code) => {
      options.signal.removeEventListener("abort", forceKill);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (options.signal.aborted) {
        reject(options.signal.reason);
        return;
      }
      if (processError) {
        reject(processError);
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Gemini CLI exited with code ${code}`));
        return;
      }
      let output: unknown;
      try {
        output = JSON.parse(stdout);
      } catch {
        reject(new Error("Gemini CLI returned invalid JSON"));
        return;
      }
      if (!isGeminiOutput(output)) {
        reject(new Error("Gemini CLI returned an invalid response envelope"));
        return;
      }
      resolve(output);
    });
    child.stdin.end();
  });
}

function isGeminiOutput(value: unknown): value is GeminiOutput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const output = value as Record<string, unknown>;
  if (output["session_id"] !== undefined
    && (typeof output["session_id"] !== "string" || output["session_id"].length === 0)) {
    return false;
  }
  const error = output["error"];
  if (error !== undefined) {
    return error !== null && typeof error === "object" && !Array.isArray(error)
      && (!("message" in error) || typeof error.message === "string");
  }
  return typeof output["response"] === "string";
}

function stringSystemMessage(systemMessage: unknown): string | undefined {
  if (systemMessage === undefined) {
    return undefined;
  }
  if (typeof systemMessage !== "string") {
    throw new TypeError("geminiEngine requires systemMessage to be a string");
  }
  return systemMessage;
}
