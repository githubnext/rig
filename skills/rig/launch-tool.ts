import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Tool } from "@github/copilot-sdk";

export type RigLaunchToolOptions = {
  uri: string;
  connectionToken: string;
  cwd: string;
  launcherPath?: string;
  timeoutMs?: number;
};

export function createRigLaunchTool(options: RigLaunchToolOptions): Tool<{ source: string }> & {
  handler: NonNullable<Tool<{ source: string }>["handler"]>;
} {
  if (!options.uri.trim() || !options.connectionToken.trim()) {
    throw new TypeError("Rig launch tool requires a nonempty URI and connection token");
  }
  const timeoutMs = options.timeoutMs ?? 180_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Rig launch tool timeoutMs must be positive");
  }
  return {
    name: "run_rig",
    description: "Run a trusted Rig TypeScript program with one default export. Supply source only; connection credentials are provided by the harness.",
    parameters: {
      type: "object",
      properties: { source: { type: "string", description: "Complete Rig TypeScript source." } },
      required: ["source"],
      additionalProperties: false,
    },
    handler: async ({ source }) => {
      if (typeof source !== "string" || !source.trim()) {
        throw new TypeError("run_rig requires nonempty TypeScript source");
      }
      const env = { ...process.env };
      delete env["COPILOT_CONNECTION_TOKEN"];
      delete env["COPILOT_SDK_URI"];
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [
          options.launcherPath ?? fileURLToPath(new URL("./run.ts", import.meta.url)),
          "--connection-fd=3",
        ], {
          cwd: options.cwd,
          env,
          stdio: ["pipe", "pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let failure: Error | undefined;
        const fail = (error: Error) => {
          failure ??= error;
          child.kill("SIGKILL");
        };
        const timer = setTimeout(() => fail(new Error("Rig launch timed out")), timeoutMs);
        const redact = (text: string) => text.replaceAll(options.connectionToken, "[redacted]");
        child.once("error", fail);
        let outputBytes = 0;
        const collect = (chunk: Buffer, output: "stdout" | "stderr") => {
          outputBytes += chunk.length;
          if (outputBytes > 1024 * 1024) {
            fail(new Error("Rig launch output exceeds 1 MiB"));
            return;
          }
          if (output === "stdout") stdout += chunk.toString();
          else stderr += chunk.toString();
        };
        child.stdout?.on("data", chunk => collect(chunk, "stdout"));
        child.stderr?.on("data", chunk => collect(chunk, "stderr"));
        child.stdin?.once("error", fail);
        const connectionPipe = child.stdio[3];
        if (!connectionPipe || !("end" in connectionPipe)) {
          fail(new Error("Rig connection pipe is unavailable"));
        } else {
          connectionPipe.once("error", fail);
          connectionPipe.end(JSON.stringify({ uri: options.uri, connectionToken: options.connectionToken }));
        }
        child.stdin?.end(source);
        child.once("close", (code, signal) => {
          clearTimeout(timer);
          if (failure) {
            reject(new Error(redact(failure.message)));
          } else if (code !== 0) {
            reject(new Error(redact(`Rig launch failed (${signal ?? code}): ${stderr}`)));
          } else {
            resolve(redact(stdout));
          }
        });
      });
    },
  };
}
