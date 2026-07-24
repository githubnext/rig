import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let sendAndWaitImpl: (request: { prompt: string; signal?: AbortSignal }) => unknown | Promise<unknown> = async () => JSON.stringify("default");
  let onImpl: ((handler: (event: unknown) => void) => void) | undefined;
  const approveAll = vi.fn();
  const disconnectSession = vi.fn(async () => {});
  const stopClient = vi.fn(async () => []);

  const createSession = vi.fn(async () => ({
    on: onImpl ? ((handler: (event: unknown) => void) => {
      onImpl?.(handler);
      return () => {};
    }) : undefined,
    sendAndWait: async (request: { prompt: string; signal?: AbortSignal }) => {
      const response = await sendAndWaitImpl(request);
      return typeof response === "string" ? response : JSON.stringify(response);
    },
    disconnect: disconnectSession,
  }));
  const forUri = vi.fn(() => ({ kind: "uri", url: "localhost:7777" }));
  const forStdio = vi.fn(() => ({ kind: "stdio" }));
  const copilotClientCtor = vi.fn();
  const CopilotClient = function (this: unknown, options: unknown) {
    copilotClientCtor(options);
    return { createSession, stop: stopClient };
  };
  const setSendAndWaitImpl = (impl: (request: { prompt: string; signal?: AbortSignal }) => unknown | Promise<unknown>) => {
    sendAndWaitImpl = impl;
  };
  const setOnImpl = (impl?: (handler: (event: unknown) => void) => void) => {
    onImpl = impl;
  };
  return {
    approveAll,
    createSession,
    disconnectSession,
    stopClient,
    forUri,
    forStdio,
    copilotClientCtor,
    CopilotClient,
    setSendAndWaitImpl,
    setOnImpl,
  };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: mocks.forStdio },
}));

import { AgentError, PromptBuilder, agent, analyzeResponse, configureAgent, copilotEngine, defineTool, p, s, toJsonSchema } from "rig";
import type { Tool } from "rig";
import { oncePerAgent, repair, steering, timeout } from "rig/addons";

beforeEach(() => {
  mocks.createSession.mockClear();
  mocks.approveAll.mockClear();
  mocks.forUri.mockClear();
  mocks.forStdio.mockClear();
  mocks.copilotClientCtor.mockClear();
  mocks.disconnectSession.mockClear();
  mocks.stopClient.mockClear();
  mocks.setOnImpl(undefined);
  mocks.setSendAndWaitImpl(async () => JSON.stringify("default"));
  configureAgent(copilotEngine());
  vi.restoreAllMocks();
});

describe("agent", () => {
  it("creates an agent from a structured spec", () => {
    const classify = agent({
      name: "classify",
      instructions: "Classify the issue.",
      input: s.object({
        title: s.string,
        body: s.string,
      }),
      output: s.object({
        label: s.enum("bug", "feature", "question", "docs"),
        confidence: s.enum("low", "medium", "high"),
      }),
    });

    expect(classify.agentName).toBe("classify");
    expect(classify.inputSchema).toEqual(s.object({ title: s.string, body: s.string }));
    expect(classify.outputSchema).toEqual(s.object({
      label: s.enum("bug", "feature", "question", "docs"),
      confidence: s.enum("low", "medium", "high"),
    }));
  });

  it("preserves type inference for schema helpers", async () => {
    mocks.setSendAndWaitImpl(async () => ({
      summary: "Looks good",
      risk: "low",
      findings: [{ file: "src/index.ts", message: "Check edge case" }],
    }));

    const review = agent({
      name: "review",
      input: s.object({ diff: s.string }),
      output: s.object({
        summary: s.string,
        risk: s.enum("low", "medium", "high"),
        findings: s.array(s.object({
          file: s.string,
          line: s.optional(s.number),
          message: s.string,
        })),
      }),
    });

    type Review = Awaited<ReturnType<typeof review>>;
    const risk: Review["risk"] = "low";
    const line: Review["findings"][number]["line"] = undefined;

    const result = await review({ diff: "..." });
    expect(risk).toBe("low");
    expect(line).toBeUndefined();
    expect(result.risk).toBe("low");
    expect(result.findings[0]?.line).toBeUndefined();
  });

  it("defaults omitted agent names", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));
    const unnamed = agent({});

    expect(unnamed.agentName).toBe("agent");
    await expect(unnamed("hello")).resolves.toBe("ok");
  });

  it("rejects implicit schema syntax at runtime", () => {
    expect(() => agent({
      name: "implicit-top-level",
      input: { text: "go" } as any,
    })).toThrow(/Use declarative s\.\* schema helpers/);

    expect(() => agent({
      name: "implicit-nested",
      input: s.object({ text: "go" as any }),
    })).toThrow(/input\.text/);

    expect(() => agent({
      name: "implicit-nullable-nested",
      output: s.nullable(s.object({ score: "bad" as any })),
    })).toThrow(/output\.score/);
  });

  it("does not expose deprecated hook APIs in core", () => {
    expect((agent as { on?: unknown }).on).toBeUndefined();
    expect((agent as { use?: unknown }).use).toBeUndefined();
  });

  it("does not expose lifecycle subscription APIs on agents", () => {
    const myAgent = agent({ name: "test-agent" }) as { subscribe?: unknown };
    expect(myAgent.subscribe).toBeUndefined();
  });

  it("defaults omitted input and output schemas to string", () => {
    const textAgent = agent({ name: "text-agent" });
    expect(textAgent.inputSchema).toEqual(s.string);
    expect(textAgent.outputSchema).toEqual(s.string);
  });

  it("uses empty strings for omitted default string inputs", async () => {
    const prompts: string[] = [];
    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return JSON.stringify("ok");
    });

    const textAgent = agent({ name: "text-agent" });
    await expect((textAgent as (input?: string) => Promise<string>)()).resolves.toBe("ok");
    expect(prompts[0]).toContain("<output_schema>\n{\n  \"type\": \"string\"\n}\n</output_schema>");
    expect(prompts[0]).toContain("<input>\n\"\"\n</input>");
    expect(prompts[0]).toContain("Return exactly one JSON value.");
  });
});

describe("agent invocation", () => {
  it("runs against a configured SDK-neutral agent implementation", async () => {
    const ask = vi.fn(async () => JSON.stringify({ text: "custom" }));
    const close = vi.fn(async () => {});
    const factory = vi.fn(() => ({ ask, close }));
    configureAgent(factory);
    const greet = agent({
      name: "greeter",
      model: "custom-model",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "custom" });
    expect(factory).toHaveBeenCalledWith({ model: "custom-model" });
    expect(ask).toHaveBeenCalledWith(expect.stringContaining("Hi"), undefined);
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
  });

  it("calls the copilot sdk and returns validated data", async () => {
    mocks.setSendAndWaitImpl(async () => ({ text: "hello world" }));
    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "hello world" });
    expect(mocks.disconnectSession).toHaveBeenCalledTimes(1);
    expect(mocks.stopClient).toHaveBeenCalledTimes(1);
  });

  it("closes the session and client when a call fails", async () => {
    mocks.setSendAndWaitImpl(async () => {
      throw new Error("boom");
    });
    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    await expect(greet({ text: "Hi" })).rejects.toThrow("boom");
    expect(mocks.disconnectSession).toHaveBeenCalledTimes(1);
    expect(mocks.stopClient).toHaveBeenCalledTimes(1);
  });

  it("creates one SDK agent implementation for each nested agent invocation", async () => {
    const child = agent({
      name: "child",
      model: "o3-mini",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });
    const parent = agent({
      name: "parent",
      model: "small",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      if (prompt.includes('"text": "parent"')) {
        await child({ text: "child" });
        return { text: "parent-ok" };
      }
      return { text: "child-ok" };
    });

    await expect(parent({ text: "parent" })).resolves.toEqual({ text: "parent-ok" });
    expect(mocks.copilotClientCtor).toHaveBeenCalledTimes(2);
    expect(mocks.createSession).toHaveBeenCalledTimes(2);
    expect(mocks.createSession.mock.calls).toEqual([
      [{ model: "small", streaming: false, onPermissionRequest: mocks.approveAll }],
      [{ model: "o3-mini", streaming: false, onPermissionRequest: mocks.approveAll }],
    ]);
    expect(mocks.disconnectSession).toHaveBeenCalledTimes(2);
    expect(mocks.stopClient).toHaveBeenCalledTimes(2);
  });

  it("logs raw Copilot SDK events and rig ask events as JSONL", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true as any);
    mocks.setOnImpl((handler) => {
      handler({ type: "session.idle", data: { done: true } });
    });
    mocks.setSendAndWaitImpl(async () => ({ text: "hello world" }));

    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "hello world" });

    const logs = stderr.mock.calls.map(([chunk]) => JSON.parse(String(chunk).trim()));
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({ type: "session.idle", data: { done: true } });
    expect(logs[1]).toMatchObject({
      type: "rig.agent.ask",
      data: { prompt: expect.stringContaining("Hi") },
    });
  });

  it("exposes the SDK-neutral agent through an addon", async () => {
    const addon = vi.fn(async (context, next) => {
      await next();
      expect(context.agent).toMatchObject({
        ask: expect.any(Function),
        close: expect.any(Function),
      });
    });
    mocks.setSendAndWaitImpl(async () => ({ text: "hello world" }));

    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
      addons: addon,
    });

    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "hello world" });
    expect(addon).toHaveBeenCalledTimes(1);
  });

  it("applies default addons from agent spec", async () => {
    const addon = vi.fn(async (_context, next) => {
      await next();
    });
    mocks.setSendAndWaitImpl(async () => ({ text: "hello world" }));

    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
      addons: addon,
    });

    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "hello world" });
    expect(addon).toHaveBeenCalledTimes(1);
  });

  it("supports express-like addon registration with use()", async () => {
    const order: number[] = [];
    const first = vi.fn(async (_context, next) => {
      order.push(1);
      await next();
    });
    const second = vi.fn(async (_context, next) => {
      order.push(2);
      await next();
    });
    mocks.setSendAndWaitImpl(async () => ({ text: "hello world" }));

    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    expect(greet.use(first).use(second)).toBe(greet);
    await expect(greet({ text: "Hi" })).resolves.toEqual({ text: "hello world" });
    expect(order).toEqual([1, 2]);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("validates addons passed to use()", () => {
    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });

    expect(() => greet.use([null as unknown as any] as any)).toThrow(
      "Agent addon entries must be functions (entry at index 0 is null).",
    );
  });

  it("disconnects the session when an addon throws", async () => {
    const addon = vi.fn(() => {
      throw new Error("hook failed");
    });
    const greet = agent({
      name: "greeter",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
      addons: addon,
    });

    await expect(greet({ text: "Hi" })).rejects.toThrow("hook failed");
    expect(mocks.disconnectSession).toHaveBeenCalledTimes(1);
  });

  it("starts with no repair addon by default", async () => {
    mocks.setSendAndWaitImpl(async () => "not json");

    const strict = agent({
      name: "strict",
      maxTurns: 2,
    });

    await expect(strict("go")).rejects.toBeInstanceOf(AgentError);
    await expect(strict("go")).rejects.toMatchObject({ kind: "parse", turn: 1 });
  });

  it("retries invalid JSON with the repair addon", async () => {
    const prompts: string[] = [];
    let calls = 0;

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      calls += 1;
      return calls === 1 ? "not json" : JSON.stringify("repaired");
    });

    const repairable = agent({
      name: "repairable",
      addons: repair(),
      maxTurns: 2,
    });

    await expect(repairable("go")).resolves.toBe("repaired");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("<repair");
    expect(prompts[1]).toContain("invalid JSON");
  });

  it("parses JSON wrapped in a fenced markdown block", async () => {
    mocks.setSendAndWaitImpl(async () => "```json\n\"hello\"\n```");

    const reviewer = agent({ name: "reviewer" });

    await expect(reviewer("go")).resolves.toBe("hello");
  });

  it("parses a JSON object embedded in surrounding text", async () => {
    mocks.setSendAndWaitImpl(async () => 'Here you go:\n{"text":"hello"}\nThanks!');

    const reviewer = agent({
      name: "reviewer",
      output: s.object({ text: s.string }),
    });

    await expect(reviewer("go")).resolves.toEqual({ text: "hello" });
  });

  it("parses a JSON array embedded in surrounding text", async () => {
    mocks.setSendAndWaitImpl(async () => 'Here are the results:\n["alpha","beta"]\nDone.');

    const lister = agent({
      name: "lister",
      output: s.array(s.string),
    });

    await expect(lister("go")).resolves.toEqual(["alpha", "beta"]);
  });

  it("retries validation failures with addon-customized repair prompts", async () => {
    const prompts: string[] = [];
    let calls = 0;

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      calls += 1;
      return calls === 1 ? { wrong: true } : JSON.stringify("fixed");
    });

    const repairable = agent({
      name: "repairable",
      addons: [
        async (context, next) => {
          await next();
          if (context.nextPrompt) {
            context.nextPrompt = `please fix: ${context.nextPrompt}`;
          }
        },
        repair(),
      ],
      maxTurns: 2,
    });

    await expect(repairable("go")).resolves.toBe("fixed");
    expect(prompts[1]).toContain("please fix");
  });

  it("throws AgentError after the final invalid turn", async () => {
    mocks.setSendAndWaitImpl(async () => "not json");

    const strict = agent({
      name: "strict",
      maxTurns: 1,
    });

    await expect(strict("go")).rejects.toBeInstanceOf(AgentError);
    await expect(strict("go")).rejects.toMatchObject({ kind: "parse" });
  });

  it("shows enum mismatch preview around the first differing substring", async () => {
    const sharedPrefix = "a".repeat(100);
    const expectedStatus = `${sharedPrefix}b`;
    const actualStatus = `${sharedPrefix}c`;
    mocks.setSendAndWaitImpl(async () => JSON.stringify({ status: actualStatus }));

    const strict = agent({
      name: "strict",
      maxTurns: 1,
      output: s.object({
        status: s.enum(expectedStatus),
      }),
    });

    try {
      await strict("go");
      throw new Error("expected validation error");
    } catch (error) {
      expect(error).toMatchObject({ kind: "validation" });
      expect(error).toBeInstanceOf(AgentError);
      expect((error as AgentError).message).toContain("got string (…");
      expect((error as AgentError).message).toContain('aaaaaaaaaaaac"');
    }
  });

  it("supports per-call model overrides", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const call = agent({ name: "model-test", model: "small" });
    await call("x", { model: "o3-mini" });

    expect(mocks.createSession).toHaveBeenCalledWith({ model: "o3-mini", streaming: false, onPermissionRequest: mocks.approveAll });
  });

  it("passes systemMessage to the session when specified", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const systemMessage = { content: "You are a helpful assistant." };
    const call = agent({ name: "sys-msg-test", systemMessage });
    await call("x");

    expect(mocks.createSession).toHaveBeenCalledWith({
      model: "small",
      streaming: false,
      onPermissionRequest: mocks.approveAll,
      systemMessage,
    });
  });

  it("does not pass systemMessage when not specified", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const call = agent({ name: "no-sys-msg-test" });
    await call("x");

    expect(mocks.createSession).toHaveBeenCalledWith({ model: "small", streaming: false, onPermissionRequest: mocks.approveAll });
  });

  it("defines tools with rig schemas using the Copilot SDK helper shape", () => {
    const lookupIssue = defineTool("lookup_issue", {
      description: "Look up an issue by id.",
      parameters: s.object({ issue: s.string }),
      handler: vi.fn(async ({ issue }) => `Issue ${issue}`),
    });
    const expectIssueTool = (_tool: Tool<{ issue: string }>) => true;
    expect(expectIssueTool(lookupIssue)).toBe(true);

    expect(lookupIssue).toEqual({
      name: "lookup_issue",
      description: "Look up an issue by id.",
      parameters: toJsonSchema(s.object({ issue: s.string })),
      handler: expect.any(Function),
      skipPermission: true,
    });
  });

  it("preserves explicit tool permission overrides", () => {
    const lookupIssue = defineTool("lookup_issue", {
      skipPermission: false,
    });

    expect(lookupIssue).toEqual({
      name: "lookup_issue",
      skipPermission: false,
      parameters: undefined,
    });
  });

  it("passes tools to the session and normalizes rig schemas", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const call = agent({
      name: "tool-test",
      tools: [{
        name: "lookup_issue",
        description: "Look up an issue by id.",
        parameters: s.object({ issue: s.string }),
        handler: async ({ issue }: { issue: string }) => `Issue ${issue}`,
      }],
    });
    await call("x");

    expect(mocks.createSession).toHaveBeenCalledWith({
      model: "small",
      onPermissionRequest: mocks.approveAll,
      streaming: false,
      tools: [expect.objectContaining({
        name: "lookup_issue",
        description: "Look up an issue by id.",
        parameters: toJsonSchema(s.object({ issue: s.string })),
        handler: expect.any(Function),
        skipPermission: true,
      })],
    });
  });

  it("supports timeout and abort signals", async () => {
    mocks.setSendAndWaitImpl(async ({ signal }) => {
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        setTimeout(() => reject(new Error("should have aborted")), 5000);
      });
      return "";
    });

    const slow = agent({ name: "timeout-test" });
    await expect(slow("go", { timeout: 50 })).rejects.toThrow(/Timed out/);
  });

  it("supports timeout as an addon", async () => {
    mocks.setSendAndWaitImpl(async ({ signal }) => {
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        setTimeout(() => reject(new Error("should have aborted")), 5000);
      });
      return "";
    });

    const slow = agent({ name: "timeout-test", addons: timeout({ timeout: 50 }) });
    await expect(slow("go")).rejects.toThrow(/Timed out/);
  });

  it("inlines prompt intents and omits top-level prompt metadata", async () => {
    const prompts: string[] = [];

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return { text: "ok" };
    });

    const inspect = agent({
      name: "inspect",
      input: s.object({ status: s.string, diff: s.string }),
      output: s.object({ text: s.string }),
    });

    await inspect({
      status: p.bash("git status --short"),
      diff: p.bash("git diff --stat", { cwd: "/tmp/workspace" }),
    });

    expect(prompts[0]).not.toContain("<intents>");
    expect(prompts[0]).not.toContain("<input_schema>");
    expect(prompts[0]).not.toContain('<agent name="inspect">');
    expect(prompts[0]).toContain("Run bash command and return stdout as text: git status --short");
    expect(prompts[0]).toContain("Run bash command and return stdout as text: git diff --stat");
    expect(prompts[0]).toContain("Rig runs inside a sandboxed agentic workflow.");
    expect(prompts[0]).toContain("without asking for extra permission or confirmation.");
    expect(prompts[0]).toContain("Options:");
    expect(prompts[0]).toContain("/tmp/workspace");
  });

  it("supports prompt helpers inside instruction templates", async () => {
    const prompts: string[] = [];

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return { text: "ok" };
    });

    const inspect = agent({
      name: "inspect",
      instructions: p`Review the repo using ${p.bash("git status --short", { cwd: "/tmp/workspace" })} before answering.`,
      output: s.object({ text: s.string }),
    });

    await inspect("go");

    expect(prompts[0]).toContain("Review the repo using Run bash command and return stdout as text: git status --short");
    expect(prompts[0]).toContain("Rig runs inside a sandboxed agentic workflow.");
    expect(prompts[0]).toContain("without asking for extra permission or confirmation.");
    expect(prompts[0]).toContain("Options:");
    expect(prompts[0]).toContain("/tmp/workspace");
    expect(prompts[0]).toContain("before answering.");
  });

  it("supports addons that steer retries near max turns", async () => {
    const prompts: string[] = [];
    let calls = 0;

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      calls += 1;
      if (calls === 1) {
        return "not json";
      }
      return prompt.includes("running out of turns")
        ? JSON.stringify("recovered")
        : "still not json";
    });

    const steerable = agent({
      name: "steerable",
      maxTurns: 2,
      addons: [
        async (context, next) => {
          await next();
          if (context.nextPrompt && context.turn === context.maxTurns - 1) {
            context.nextPrompt = `${context.nextPrompt}\nAdd a short correction because you are running out of turns.`;
          }
        },
        repair(),
      ],
    });

    await expect(steerable("go")).resolves.toBe("recovered");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("running out of turns");
  });

  it("exports a steering addon that warns near max turns", async () => {
    const prompts: string[] = [];
    let calls = 0;

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      calls += 1;
      if (calls === 1) {
        return "not json";
      }
      return prompt.includes("final attempt before reaching the turn limit")
        ? JSON.stringify("recovered")
        : "still not json";
    });

    const steerable = agent({
      name: "steerable",
      maxTurns: 2,
      addons: [steering(), repair()],
    });

    await expect(steerable("go")).resolves.toBe("recovered");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("final attempt before reaching the turn limit");
  });

  it("supports addons that validate snippets inline", async () => {
    let calls = 0;
    mocks.setSendAndWaitImpl(async () => {
      calls += 1;
      return calls === 1
        ? JSON.stringify({ code: "const x = 1;" })
        : JSON.stringify({ code: "```ts\nconst x = 1;\n```" });
    });

    const snippetGuard = agent({
      name: "snippet-guard",
      maxTurns: 2,
      output: s.object({ code: s.string }),
      addons: [
        async (context, next) => {
          await next();
          if (!context.nextPrompt && context.output && typeof context.output === "object") {
            const code = (context.output as { code?: unknown }).code;
            if (typeof code === "string" && !code.includes("```")) {
              context.completed = false;
              context.output = undefined;
              context.nextPrompt = "Return the same payload but wrap code in a fenced markdown block.";
            }
          }
        },
        repair(),
      ],
    });

    await expect(snippetGuard("go")).resolves.toEqual({ code: "```ts\nconst x = 1;\n```" });
  });

  it("rejects non-function addon entries", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));
    const guarded = agent({ name: "guarded", addons: [null as unknown as any] as any });
    await expect(guarded("go")).rejects.toThrow(
      "Agent addon entries must be functions (entry at index 0 is null).",
    );
  });

  it("registers with the runtime agent once per call", async () => {
    let turns = 0;
    const register = vi.fn();
    mocks.setSendAndWaitImpl(async () => {
      turns += 1;
      return turns === 1 ? "not json" : JSON.stringify("hello world");
    });

    const review = agent({
      name: "review",
      maxTurns: 2,
      addons: [
        oncePerAgent(async (runtimeAgent, context) => {
          register(runtimeAgent, context.turn);
        }),
        repair(),
      ],
    });

    await expect(review("go")).resolves.toBe("hello world");
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        ask: expect.any(Function),
        close: expect.any(Function),
      }),
      1,
    );
  });

  it("renders schema descriptions for discovery", async () => {
    const prompts: string[] = [];

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return { text: "ok" };
    });

    const describeSchema = agent({
      name: "describe-schema",
      output: s.object({
        text: s.string("Final answer text"),
      }, "Response payload"),
    });

    await describeSchema("go");

    expect(prompts[0]).toContain("\"text\": {\n      \"type\": \"string\",\n      \"description\": \"Final answer text\"\n    }");
    expect(prompts[0]).toContain("\"description\": \"Response payload\"");
  });

  it("renders subagent metadata for delegated task-solving prompts", async () => {
    const prompts: string[] = [];

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return { markdown: "```rig\nexport default agent({ name: \"root\" });\n```" };
    });

    const draftRigMarkdown = agent({
      name: "draft-rig-markdown",
      model: "mini",
      instructions: "Generate a markdown response containing one ```rig block that solves the task.",
      input: s.object({ task: s.string }),
      output: s.object({ markdown: s.string }),
    });

    const orchestrator = agent({
      name: "orchestrator",
      model: "large",
      instructions: "Use the delegated subagents to solve the task and return the markdown program.",
      input: s.object({ task: s.string }),
      output: s.object({ markdown: s.string }),
      agents: { draftRigMarkdown },
    });

    await orchestrator({ task: "Create a rig markdown program that reviews a pull request diff." });

    expect(prompts[0]).toContain("<subagents>");
    expect(prompts[0]).toContain('"name": "draftRigMarkdown"');
    expect(prompts[0]).toContain('"instructions": "Generate a markdown response containing one ```rig block that solves the task."');
    expect(prompts[0]).toContain('"model": "mini"');
    expect(prompts[0]).toContain('"input": "{');
    expect(prompts[0]).toContain('"output": "{');
  });
});

describe("prompt intents", () => {
  it("exports prompt helpers from p and hides internal helpers", async () => {
    const compat = await import("rig");
    expect(compat.p.read("README.md").mode).toBe("prompt.read");
    expect(compat.p.bash("git status --short").mode).toBe("prompt.text");
    expect(typeof compat.p).toBe("function");
    expect((compat as Record<string, unknown>)["sh"]).toBeUndefined();
    expect((compat as Record<string, unknown>)["validate"]).toBeUndefined();
    expect((compat as Record<string, unknown>)["collectIntents"]).toBeUndefined();
  });

  it("creates prompt intents via p helpers", () => {
    const diff = p.bash("git diff");
    const testOutput = p.bash("npm test", { cwd: "/tmp/workspace" });
    const readme = p.read("README.md");
    const tsFiles = p.glob("src/**/*.ts");

    expect(diff.mode).toBe("prompt.text");
    expect(testOutput.mode).toBe("prompt.text");
    expect(testOutput.options).toEqual({ cwd: "/tmp/workspace" });
    expect(readme.mode).toBe("prompt.read");
    expect(tsFiles.mode).toBe("prompt.glob");
    expect(tsFiles.pattern).toBe("src/**/*.ts");
  });

  it("p.glob stores pattern and supports options", () => {
    const intent = p.glob("**/*.md", { cwd: "/workspace" });

    expect(intent.mode).toBe("prompt.glob");
    expect(intent.pattern).toBe("**/*.md");
    expect(intent.options).toEqual({ cwd: "/workspace" });
  });

  it("p.readOptional stores path, default fallback, and mode", () => {
    const intent = p.readOptional("Dockerfile");

    expect(intent.mode).toBe("prompt.readOptional");
    expect(intent.path).toBe("Dockerfile");
    expect(intent.fallback).toBe("");
  });

  it("p.readOptional stores custom fallback", () => {
    const intent = p.readOptional(".eslintrc.json", "{}");

    expect(intent.mode).toBe("prompt.readOptional");
    expect(intent.path).toBe(".eslintrc.json");
    expect(intent.fallback).toBe("{}");
  });

  it("p.env stores variable name, default fallback, and mode", () => {
    const intent = p.env("GITHUB_TOKEN");

    expect(intent.mode).toBe("prompt.env");
    expect(intent.command).toBe("GITHUB_TOKEN");
    expect(intent.fallback).toBe("");
  });

  it("p.env stores custom fallback", () => {
    const intent = p.env("GITHUB_TOKEN", "unset");

    expect(intent.mode).toBe("prompt.env");
    expect(intent.command).toBe("GITHUB_TOKEN");
    expect(intent.fallback).toBe("unset");
  });

  it("p.json serializes a value to a pretty JSON string", () => {
    expect(p.json({ key: "value" })).toBe('{\n  "key": "value"\n}');
    expect(p.json([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]');
    expect(p.json("hello")).toBe('"hello"');
  });

  it("strips AbortSignal from intent options", () => {
    const controller = new AbortController();
    const intent = p.bash("echo hi", { cwd: "/tmp", signal: controller.signal });

    expect(intent.options).toEqual({ cwd: "/tmp" });
  });

  it("p.bashRaw preserves raw backslashes without TypeScript escaping", () => {
    const intent = p.bashRaw`grep -rn 'app\.get\|app\.post' src/`;

    expect(intent.mode).toBe("prompt.text");
    expect(intent.command).toBe("grep -rn 'app\\.get\\|app\\.post' src/");
  });

  it("p.bashRaw interpolates template expressions", () => {
    const dir = "src";
    const intent = p.bashRaw`find ${dir} -name '*.ts'`;

    expect(intent.mode).toBe("prompt.text");
    expect(intent.command).toBe("find src -name '*.ts'");
  });

  it("p.writeOutput stores field and path with mode prompt.writeOutput", () => {
    const intent = p.writeOutput("report", "todo-report.md");

    expect(intent.mode).toBe("prompt.writeOutput");
    expect(intent.field).toBe("report");
    expect(intent.path).toBe("todo-report.md");
  });

  it("p.writeOutput supports options", () => {
    const intent = p.writeOutput("summary", "output.md", { cwd: "/workspace" });

    expect(intent.mode).toBe("prompt.writeOutput");
    expect(intent.field).toBe("summary");
    expect(intent.path).toBe("output.md");
    expect(intent.options).toEqual({ cwd: "/workspace" });
  });

  it("p.readAll stores paths array with mode prompt.readAll", () => {
    const intent = p.readAll(["src/index.ts", "src/utils.ts"]);

    expect(intent.mode).toBe("prompt.readAll");
    expect(intent.paths).toEqual(["src/index.ts", "src/utils.ts"]);
  });

  it("p.readAll supports options", () => {
    const intent = p.readAll(["README.md"], { cwd: "/workspace" });

    expect(intent.mode).toBe("prompt.readAll");
    expect(intent.paths).toEqual(["README.md"]);
    expect(intent.options).toEqual({ cwd: "/workspace" });
  });

  it("p.readInput stores field name with mode prompt.readInput", () => {
    const intent = p.readInput("path");

    expect(intent.mode).toBe("prompt.readInput");
    expect(intent.field).toBe("path");
  });

  it("p.readInput supports options", () => {
    const intent = p.readInput("filePath", { cwd: "/workspace" });

    expect(intent.mode).toBe("prompt.readInput");
    expect(intent.field).toBe("filePath");
    expect(intent.options).toEqual({ cwd: "/workspace" });
  });
});

describe("prompt builder", () => {
  it("exposes prompt helpers on p", () => {
    expect(p.read("README.md").mode).toBe("prompt.read");
    expect(p.bash("git status --short").mode).toBe("prompt.text");
    expect(p.write("README.md", "# Updated\n").mode).toBe("prompt.write");
    expect(p.glob("src/**/*.ts").mode).toBe("prompt.glob");
  });

  it("returns a prompt builder from tagged template syntax", () => {
    const builder = p`Repository: ${p.var("repo", "rig")}\nStatus: ${p.bash("git status --short")}`;

    expect(builder).toBeInstanceOf(PromptBuilder);
    expect(String(builder)).toContain("Repository: rig");
    expect(String(builder)).toContain("Run bash command and return stdout as text: git status --short");
  });

  it("normalizes indentation for multiline tagged template syntax", () => {
    const builder = p`
      Generate a patch.
      Use ${p.read("README.md")} as context.
      Return only valid JSON.
    `;

    const rendered = String(builder);
    expect(rendered).toContain("Generate a patch.");
    expect(rendered).toContain("Use Read file and return its contents as text: \"README.md\"");
    expect(rendered).toContain("sandboxed agentic workflow");
    expect(rendered).toContain("as context.");
    expect(rendered).toContain("Return only valid JSON.");
    expect(rendered.startsWith("Generate a patch.\nUse ")).toBe(true);
    expect(rendered.startsWith("\n")).toBe(false);
    expect(rendered.endsWith("\n")).toBe(false);
    expect(rendered.split("\n").every((line) => !line.startsWith("      "))).toBe(true);
  });

  it("builds prompt text with variables and intents", () => {
    const builder = p();
    const repo = builder.var("repo", "rig");
    builder.write("Repository: ", repo, "\n");
    builder.write("Status: ", builder.bash("git status --short"));

    expect(builder.get("repo")).toBe("rig");
    expect(String(builder)).toContain("Repository: rig");
    expect(String(builder)).toContain("Run bash command and return stdout as text: git status --short");
  });

  it("creates code regions", () => {
    const builder = p();
    builder.region("ts", "const done = true;");

    expect(String(builder)).toBe("```ts\nconst done = true;\n```\n");
    expect(p.region("json", "{\n  \"ok\": true\n}")).toContain("```json");
  });

  it("renders p.glob intent as a file-list instruction", () => {
    const builder = p`Find TypeScript sources: ${p.glob("src/**/*.ts")}`;

    expect(String(builder)).toContain('List files matching glob pattern "src/**/*.ts"');
    expect(String(builder)).toContain("sandboxed agentic workflow");
  });

  it("inlines p.json as a pretty JSON string", () => {
    const builder = p`Context: ${p.json({ repo: "rig" })}`;

    expect(String(builder)).toContain('Context: {\n  "repo": "rig"\n}');
  });

  it("renders p.readOptional as a conditional-read instruction", () => {
    const builder = p`Lint config: ${p.readOptional(".eslintrc.json", "{}")}`;

    expect(String(builder)).toContain('Read file and return its contents as text: ".eslintrc.json". If the file does not exist, return "{}" instead');
    expect(String(builder)).toContain("sandboxed agentic workflow");
  });

  it("renders p.env as an environment-variable instruction", () => {
    const builder = p`Token: ${p.env("GITHUB_TOKEN", "unset")}`;

    expect(String(builder)).toContain('Read environment variable "GITHUB_TOKEN" and return its value as text. If the variable is not set, return "unset" instead');
    expect(String(builder)).toContain("sandboxed agentic workflow");
  });

  it("renders p.writeOutput as a post-generation write instruction", () => {
    const builder = p`Scan for TODOs. ${p.writeOutput("report", "todo-report.md")}`;

    expect(String(builder)).toContain('output field "report"');
    expect(String(builder)).toContain('"todo-report.md"');
    expect(String(builder)).toContain("sandboxed agentic workflow");
  });
});

describe("p template literal for instructions", () => {
  it("returns a PromptBuilder from tagged template syntax", () => {
    const builder = p`Review the diff.`;

    expect(builder).toBeInstanceOf(PromptBuilder);
    expect(String(builder)).toBe("Review the diff.");
  });

  it("inlines prompt intents as expressions", () => {
    const builder = p`Review the repo using ${p.bash("git status --short")} before answering.`;

    expect(builder).toBeInstanceOf(PromptBuilder);
    expect(String(builder)).toContain("Review the repo using Run bash command and return stdout as text: git status --short");
    expect(String(builder)).toContain("before answering.");
  });

  it("inlines nested PromptBuilder as an expression", () => {
    const inner = p`World`;
    const outer = p`Hello ${inner}`;

    expect(String(outer)).toBe("Hello World");
  });

  it("can be used as instructions in an agent spec", async () => {
    const prompts: string[] = [];

    mocks.setSendAndWaitImpl(async ({ prompt }) => {
      prompts.push(prompt);
      return { text: "ok" };
    });

    const reviewAgent = agent({
      name: "review",
      instructions: p`Use ${p.bash("git diff --stat")} to review changes.`,
      output: s.object({ text: s.string }),
    });

    await reviewAgent("go");

    expect(prompts[0]).toContain("Use Run bash command and return stdout as text: git diff --stat");
    expect(prompts[0]).toContain("to review changes.");
    expect(prompts[0]).toContain("Rig runs inside a sandboxed agentic workflow.");
  });
});

describe("toJsonSchema", () => {
  it("serializes s.* helpers as native JSON Schema without conversion", () => {
    expect(JSON.parse(JSON.stringify(s.string))).toEqual({ type: "string" });
    expect(JSON.parse(JSON.stringify(s.object({
      name: s.string,
      age: s.optional(s.number),
    })))).toEqual({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "number" } },
      required: ["name"],
    });
  });

  it("converts primitive schemas", () => {
    expect(toJsonSchema(s.string)).toEqual({ type: "string" });
    expect(toJsonSchema(s.number)).toEqual({ type: "number" });
    expect(toJsonSchema(s.integer)).toEqual({ type: "integer" });
    expect(toJsonSchema(s.int)).toEqual({ type: "integer" });
    expect(toJsonSchema(s.boolean)).toEqual({ type: "boolean" });
    expect(toJsonSchema(s.null)).toEqual({ type: "null" });
    expect(toJsonSchema(s.unknown)).toEqual({});
  });

  it("converts constrained string schemas", () => {
    expect(toJsonSchema(s.nonEmptyString)).toEqual({ type: "string", minLength: 1 });
    expect(toJsonSchema(s.nonEmptyString("A non-empty value"))).toEqual({ type: "string", minLength: 1, description: "A non-empty value" });
    expect(toJsonSchema(s.url)).toEqual({ type: "string", format: "uri" });
    expect(toJsonSchema(s.url("A URL"))).toEqual({ type: "string", format: "uri", description: "A URL" });
    expect(toJsonSchema(s.path)).toEqual({ type: "string", format: "path" });
    expect(toJsonSchema(s.path("source path"))).toEqual({ type: "string", format: "path", description: "source path" });
  });

  it("includes description when present", () => {
    expect(toJsonSchema(s.string("A text value"))).toEqual({ type: "string", description: "A text value" });
    expect(toJsonSchema(s.number("A numeric value"))).toEqual({ type: "number", description: "A numeric value" });
    expect(toJsonSchema(s.integer("A count"))).toEqual({ type: "integer", description: "A count" });
  });

  it("converts enum schemas", () => {
    expect(toJsonSchema(s.enum("a", "b", "c"))).toEqual({ type: "string", enum: ["a", "b", "c"] });
    expect(toJsonSchema(s.enum(["x", "y"], "A choice"))).toEqual({ type: "string", enum: ["x", "y"], description: "A choice" });
  });

  it("converts literal schemas", () => {
    expect(toJsonSchema(s.literal("done"))).toEqual({ type: "string", enum: ["done"] });
    expect(toJsonSchema(s.literal(42))).toEqual({ enum: [42] });
    expect(toJsonSchema(s.literal(true, "must be true"))).toEqual({ enum: [true], description: "must be true" });
  });

  it("adds type:string to all-string enums but not mixed enums", () => {
    expect(toJsonSchema(s.enum("low", "medium", "high"))).toEqual({ type: "string", enum: ["low", "medium", "high"] });
    expect(toJsonSchema(s.enum(1, 2, 3))).toEqual({ enum: [1, 2, 3] });
    expect(toJsonSchema(s.enum("yes", 1))).toEqual({ enum: ["yes", 1] });
    expect(toJsonSchema(s.enum())).toEqual({ enum: [] });
  });

  it("converts array schemas", () => {
    expect(toJsonSchema(s.array(s.string))).toEqual({ type: "array", items: { type: "string" } });
    expect(toJsonSchema(s.array(s.number, "A list"))).toEqual({ type: "array", items: { type: "number" }, description: "A list" });
  });

  it("converts record schemas", () => {
    expect(toJsonSchema(s.record(s.string))).toEqual({ type: "object", additionalProperties: { type: "string" } });
  });

  it("converts object schemas with required fields", () => {
    expect(toJsonSchema(s.object({ name: s.string, age: s.number }))).toEqual({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "number" } },
      required: ["name", "age"],
    });
  });

  it("omits required for all-optional object fields", () => {
    expect(toJsonSchema(s.object({ name: s.optional(s.string) }))).toEqual({
      type: "object",
      properties: { name: { type: "string" } },
    });
  });

  it("separates required and optional object fields", () => {
    expect(toJsonSchema(s.object({ name: s.string, age: s.optional(s.number) }))).toEqual({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "number" } },
      required: ["name"],
    });
  });

  it("converts optional schemas to their inner schema", () => {
    expect(toJsonSchema(s.optional(s.string))).toEqual({ type: "string" });
    expect(toJsonSchema(s.optional(s.string, "maybe text"))).toEqual({ type: "string", description: "maybe text" });
  });

  it("converts nested schemas", () => {
    expect(toJsonSchema(s.object({
      items: s.array(s.object({ id: s.number, label: s.string })),
    }))).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "number" }, label: { type: "string" } },
            required: ["id", "label"],
          },
        },
      },
      required: ["items"],
    });
  });

  it("is accessible as s.toJsonSchema", () => {
    expect(s.toJsonSchema(s.string)).toEqual({ type: "string" });
  });
});

describe("s.nullable", () => {
  it("serializes to anyOf with null", () => {
    expect(toJsonSchema(s.nullable(s.string))).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(toJsonSchema(s.nullable(s.number))).toEqual({ anyOf: [{ type: "number" }, { type: "null" }] });
  });

  it("includes description when provided", () => {
    expect(toJsonSchema(s.nullable(s.string, "maybe text"))).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "maybe text",
    });
  });

  it("accepts null values during validation", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify({ score: null }));
    const a = agent({ output: s.object({ score: s.nullable(s.number) }) });
    const result = await a("");
    expect(result).toEqual({ score: null });
  });

  it("accepts non-null values during validation", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify({ score: 42 }));
    const a = agent({ output: s.object({ score: s.nullable(s.number) }) });
    const result = await a("");
    expect(result).toEqual({ score: 42 });
  });

  it("rejects invalid values that are neither null nor inner type", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify({ score: "not-a-number" }));
    const a = agent({ output: s.object({ score: s.nullable(s.number) }), maxTurns: 1 });
    await expect(a("")).rejects.toBeInstanceOf(AgentError);
  });
});

describe("s.integer validation", () => {
  it("accepts whole numbers", () => {
    const intAgent = agent({ output: s.integer });
    expect(intAgent.outputSchema).toEqual(s.integer);
    expect(toJsonSchema(s.integer)).toEqual({ type: "integer" });
  });

  it("rejects floats in validation", () => {
    const result = analyzeResponse(JSON.stringify(1.5), s.integer, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("expected integer");
    }
  });

  it("accepts integers in validation", () => {
    const result = analyzeResponse(JSON.stringify(3), s.integer, "test", 1);
    expect(result.ok).toBe(true);
  });
});

describe("s.int", () => {
  it("is an alias for s.integer and serializes to {type:'integer'}", () => {
    expect(toJsonSchema(s.int)).toEqual({ type: "integer" });
    expect(toJsonSchema(s.int("a count"))).toEqual({ type: "integer", description: "a count" });
  });

  it("rejects floats", () => {
    const result = analyzeResponse(JSON.stringify(2.7), s.int, "test", 1);
    expect(result.ok).toBe(false);
  });

  it("accepts integers", () => {
    const result = analyzeResponse(JSON.stringify(5), s.int, "test", 1);
    expect(result.ok).toBe(true);
  });
});

describe("s.nonEmptyString", () => {
  it("serializes to {type:'string', minLength:1}", () => {
    expect(toJsonSchema(s.nonEmptyString)).toEqual({ type: "string", minLength: 1 });
    expect(toJsonSchema(s.nonEmptyString("required name"))).toEqual({ type: "string", minLength: 1, description: "required name" });
  });

  it("accepts non-empty strings", () => {
    const result = analyzeResponse(JSON.stringify("hello"), s.nonEmptyString, "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = analyzeResponse(JSON.stringify(""), s.nonEmptyString, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("minLength");
    }
  });
});

describe("s.url", () => {
  it("serializes to {type:'string', format:'uri'}", () => {
    expect(toJsonSchema(s.url)).toEqual({ type: "string", format: "uri" });
    expect(toJsonSchema(s.url("target URL"))).toEqual({ type: "string", format: "uri", description: "target URL" });
  });

  it("accepts valid URLs", () => {
    const result = analyzeResponse(JSON.stringify("https://example.com/path"), s.url, "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid URLs", () => {
    const result = analyzeResponse(JSON.stringify("not-a-url"), s.url, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("valid URL");
    }
  });
});

describe("s.path", () => {
  it("serializes to {type:'string', format:'path'}", () => {
    expect(toJsonSchema(s.path)).toEqual({ type: "string", format: "path" });
    expect(toJsonSchema(s.path("source file"))).toEqual({ type: "string", format: "path", description: "source file" });
  });

  it("accepts any string value", () => {
    const result = analyzeResponse(JSON.stringify("src/index.ts"), s.path, "test", 1);
    expect(result.ok).toBe(true);
  });

  it("is usable as an object field", () => {
    const schema = s.object({ filePath: s.path });
    expect(toJsonSchema(schema)).toEqual({
      type: "object",
      properties: { filePath: { type: "string", format: "path" } },
      required: ["filePath"],
    });
  });
});

describe("s.null", () => {
  it("serializes to {type:'null'}", () => {
    expect(toJsonSchema(s.null)).toEqual({ type: "null" });
    expect(toJsonSchema(s.null("cleared"))).toEqual({ type: "null", description: "cleared" });
  });

  it("accepts null in validation", () => {
    const result = analyzeResponse("null", s.null, "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects non-null values", () => {
    const result = analyzeResponse(JSON.stringify("oops"), s.null, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("expected null");
    }
  });

  it("infers null type in TypeScript via agent output", () => {
    const a = agent({ output: s.null });
    expect(a.outputSchema).toEqual(s.null);
  });

  it("works as an object field", () => {
    const schema = s.object({ value: s.null });
    expect(toJsonSchema(schema)).toEqual({
      type: "object",
      properties: { value: { type: "null" } },
      required: ["value"],
    });
    const result = analyzeResponse(JSON.stringify({ value: null }), schema, "test", 1);
    expect(result.ok).toBe(true);
  });
});

describe("s.literal", () => {
  it("serializes a string literal to an all-string enum schema", () => {
    expect(toJsonSchema(s.literal("done"))).toEqual({ type: "string", enum: ["done"] });
  });

  it("serializes a number literal to an enum schema without type:string", () => {
    expect(toJsonSchema(s.literal(42))).toEqual({ enum: [42] });
  });

  it("accepts the exact literal value in validation", () => {
    const result = analyzeResponse(JSON.stringify("done"), s.literal("done"), "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects a different value in validation", () => {
    const result = analyzeResponse(JSON.stringify("pending"), s.literal("done"), "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('"done"');
    }
  });

  it("supports an optional description", () => {
    expect(toJsonSchema(s.literal("active", "must be active"))).toEqual({
      type: "string",
      enum: ["active"],
      description: "must be active",
    });
  });
});

describe("s.nonEmptyArray", () => {
  it("serializes to {type:'array', items:..., minItems:1}", () => {
    expect(toJsonSchema(s.nonEmptyArray(s.string))).toEqual({ type: "array", items: { type: "string" }, minItems: 1 });
    expect(toJsonSchema(s.nonEmptyArray(s.number, "scores"))).toEqual({
      type: "array",
      items: { type: "number" },
      minItems: 1,
      description: "scores",
    });
  });

  it("accepts arrays with at least one element", () => {
    const result = analyzeResponse(JSON.stringify(["hello"]), s.nonEmptyArray(s.string), "test", 1);
    expect(result.ok).toBe(true);
  });

  it("accepts arrays with multiple elements", () => {
    const result = analyzeResponse(JSON.stringify(["a", "b", "c"]), s.nonEmptyArray(s.string), "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects empty arrays", () => {
    const result = analyzeResponse(JSON.stringify([]), s.nonEmptyArray(s.string), "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("at least 1 item");
    }
  });

  it("still validates item types in a non-empty array", () => {
    const result = analyzeResponse(JSON.stringify([42]), s.nonEmptyArray(s.string), "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("string");
    }
  });

  it("works as an object field", () => {
    const schema = s.object({ tags: s.nonEmptyArray(s.string) });
    expect(toJsonSchema(schema)).toEqual({
      type: "object",
      properties: { tags: { type: "array", items: { type: "string" }, minItems: 1 } },
      required: ["tags"],
    });
    const result = analyzeResponse(JSON.stringify({ tags: ["rig"] }), schema, "test", 1);
    expect(result.ok).toBe(true);
  });
});

describe("s.nonEmptyObject", () => {
  it("serializes to {type:'object', additionalProperties:..., minProperties:1}", () => {
    expect(toJsonSchema(s.nonEmptyObject(s.string))).toEqual({ type: "object", additionalProperties: { type: "string" }, minProperties: 1 });
    expect(toJsonSchema(s.nonEmptyObject(s.number, "scores by name"))).toEqual({
      type: "object",
      additionalProperties: { type: "number" },
      minProperties: 1,
      description: "scores by name",
    });
  });

  it("accepts objects with at least one key", () => {
    const result = analyzeResponse(JSON.stringify({ a: "hello" }), s.nonEmptyObject(s.string), "test", 1);
    expect(result.ok).toBe(true);
  });

  it("accepts objects with multiple keys", () => {
    const result = analyzeResponse(JSON.stringify({ a: "x", b: "y", c: "z" }), s.nonEmptyObject(s.string), "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects empty objects", () => {
    const result = analyzeResponse(JSON.stringify({}), s.nonEmptyObject(s.string), "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("at least 1 key");
    }
  });

  it("still validates value types in a non-empty object", () => {
    const result = analyzeResponse(JSON.stringify({ a: 42 }), s.nonEmptyObject(s.string), "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("string");
    }
  });

  it("works as an object field", () => {
    const schema = s.object({ labels: s.nonEmptyObject(s.string) });
    expect(toJsonSchema(schema)).toEqual({
      type: "object",
      properties: { labels: { type: "object", additionalProperties: { type: "string" }, minProperties: 1 } },
      required: ["labels"],
    });
    const result = analyzeResponse(JSON.stringify({ labels: { env: "prod" } }), schema, "test", 1);
    expect(result.ok).toBe(true);
  });
});

describe("missing required field error message", () => {
  it("reports a missing required string field clearly", () => {
    const schema = s.object({ name: s.string, age: s.number });
    const result = analyzeResponse(JSON.stringify({ age: 30 }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.name");
      expect(result.error.message).toContain("string");
    }
  });

  it("reports a missing required boolean field clearly", () => {
    const schema = s.object({ breaking: s.boolean, summary: s.string });
    const result = analyzeResponse(JSON.stringify({ summary: "no changes" }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.breaking");
      expect(result.error.message).toContain("boolean");
    }
  });

  it("does not report missing for optional fields", () => {
    const schema = s.object({ name: s.string, note: s.optional(s.string) });
    const result = analyzeResponse(JSON.stringify({ name: "Alice" }), schema, "test", 1);
    expect(result.ok).toBe(true);
  });

  it("rejects null for optional fields with a clear 'omit or provide valid value' message", () => {
    const schema = s.object({ name: s.string, note: s.optional(s.string) });
    const result = analyzeResponse(JSON.stringify({ name: "Alice", note: null }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("$.note");
      expect(result.error.message).toContain("optional field must be omitted");
      expect(result.error.message).toContain("s.nullable");
    }
  });

  it("reports a missing required array field with type 'array'", () => {
    const schema = s.object({ items: s.array(s.string), name: s.string });
    const result = analyzeResponse(JSON.stringify({ name: "x" }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.items");
      expect(result.error.message).toContain("array");
    }
  });

  it("reports a missing required nullable field with '<inner> | null'", () => {
    const schema = s.object({ score: s.nullable(s.number), name: s.string });
    const result = analyzeResponse(JSON.stringify({ name: "x" }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.score");
      expect(result.error.message).toContain("number | null");
    }
  });

  it("reports a missing required enum field with enum values", () => {
    const schema = s.object({ status: s.enum("open", "closed"), name: s.string });
    const result = analyzeResponse(JSON.stringify({ name: "x" }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.status");
      expect(result.error.message).toContain('"open"');
    }
  });

  it("reports a missing required unknown field with 'any'", () => {
    const schema = s.object({ payload: s.unknown, name: s.string });
    const result = analyzeResponse(JSON.stringify({ name: "x" }), schema, "test", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing required field");
      expect(result.error.message).toContain("$.payload");
      expect(result.error.message).toContain("any");
    }
  });
});
