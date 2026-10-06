import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertThreeJudges } from "../fixtures/assert-three-judges.ts";

const parameters = Type.Object({}, { additionalProperties: false });
type PiRigTool = AgentTool<typeof parameters, unknown>;
type PiRigOptions = {
  cwd: string;
  agentDir: string;
  outputPath: string;
  timeoutMs?: number;
};

export function createPiRigTool(options: PiRigOptions): PiRigTool {
  if (![options.cwd, options.agentDir, options.outputPath].every(value => value.trim())) {
    throw new TypeError("Pi Rig tool requires workspace, agent directory, and output paths");
  }
  const timeoutMs = options.timeoutMs ?? 180_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Pi Rig tool timeoutMs must be positive");
  }
  let invoked = false;
  return {
    name: "run_rig",
    label: "Run Rig judges",
    description: "Run the checked-in Pi three-judge Rig fixture exactly once. Takes no arguments: the harness owns the source, input, gateway configuration, and output path. Returns the validated judgments and majority verdict.",
    parameters,
    async execute(_toolCallId, args, signal) {
      if (invoked) throw new Error("The integration fixture may only be launched once");
      invoked = true;
      if (Object.keys(args).length) throw new TypeError("run_rig takes no arguments");
      signal?.throwIfAborted();
      await rm(options.outputPath, { force: true });
      const stdout = await new Promise<string>((resolve, reject) => {
        let inputError: Error | undefined;
        const child = execFile(process.execPath, [
          join(options.cwd, "skills/rig/run.ts"),
          join(options.cwd, ".github/fixtures/provider-three-judges.ts"),
        ], {
          cwd: options.cwd,
          env: {
            PATH: process.env["PATH"],
            RIG_JUDGE_ENGINE: "pi",
            PI_CODING_AGENT_DIR: options.agentDir,
          },
          timeout: timeoutMs,
          killSignal: "SIGKILL",
          maxBuffer: 1024 * 1024,
          ...(signal ? { signal } : {}),
        }, (error, output, stderr) => {
          const failure = inputError ?? error;
          if (failure) reject(new Error(`Rig fixture failed: ${failure.message}\n${stderr}`, { cause: failure }));
          else resolve(output);
        });
        if (!child.stdin) {
          inputError = new Error("Rig launcher stdin is unavailable");
          child.kill("SIGKILL");
        } else {
          child.stdin.once("error", error => {
            inputError = error;
            child.kill("SIGKILL");
          });
          child.stdin.end("{}\n");
        }
      });
      const result: unknown = JSON.parse(stdout);
      assertThreeJudges(result, "pi");
      await writeFile(options.outputPath, stdout, { encoding: "utf8", mode: 0o600 });
      return { content: [{ type: "text", text: stdout }], details: result };
    },
  };
}

export default function piRigExtension(pi: { registerTool(tool: PiRigTool): void }): void {
  const cwd = process.env["GITHUB_WORKSPACE"];
  const agentDir = process.env["PI_CODING_AGENT_DIR"];
  if (!cwd || !agentDir) throw new Error("GITHUB_WORKSPACE and PI_CODING_AGENT_DIR are required");
  pi.registerTool(createPiRigTool({ cwd, agentDir, outputPath: "/tmp/gh-aw/agent/rig-three-judges.json" }));
}
