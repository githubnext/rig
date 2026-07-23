import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { AgentFactory } from "../rig.ts";

export type GeminiEngineOptions = {
  command?: string;
  cwd?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  approvalMode?: "default" | "auto_edit" | "yolo" | "plan";
};

type GeminiOutput = {
  session_id?: string;
  response?: string;
  error?: {
    message?: string;
  };
};

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
    const systemMessage = stringSystemMessage(agentOptions.systemMessage);
    const closeController = new AbortController();
    const activeTurns = new Set<Promise<unknown>>();
    let activeProcess: ChildProcessWithoutNullStreams | undefined;
    let sessionId: string | undefined;

    return {
      async ask(prompt, askOptions = {}) {
        throwIfAborted(closeController.signal);
        if (activeProcess) {
          throw new Error("geminiEngine does not support concurrent turns");
        }
        const signal = askOptions.signal
          ? AbortSignal.any([askOptions.signal, closeController.signal])
          : closeController.signal;
        throwIfAborted(signal);
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
        const activeTurn = runGemini(command, cliArgs, {
          ...(cwd !== undefined && { cwd }),
          env: { ...process.env, ...env },
          signal,
          onSpawn(child) {
            activeProcess = child;
          },
        });
        activeTurns.add(activeTurn);
        try {
          const output = await activeTurn;
          sessionId = output.session_id ?? nextSessionId;
          if (output.error) {
            throw new Error(output.error.message ?? "Gemini CLI request failed");
          }
          return output.response ?? "";
        } finally {
          activeProcess = undefined;
          activeTurns.delete(activeTurn);
        }
      },
      async close() {
        closeController.abort(new DOMException("Agent closed", "AbortError"));
        await Promise.allSettled(activeTurns);
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
    onSpawn(child: ChildProcessWithoutNullStreams): void;
  },
): Promise<GeminiOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal,
    });
    options.onSpawn(child);
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
      if (processError) {
        reject(processError);
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Gemini CLI exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as GeminiOutput);
      } catch {
        reject(new Error("Gemini CLI returned invalid JSON"));
      }
    });
  });
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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}
