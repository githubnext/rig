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
  const sdkDefineTool = vi.fn((name: string, config: Record<string, unknown>) => ({ name, ...config }));
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
    sdkDefineTool,
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
  defineTool: mocks.sdkDefineTool,
}));

import { AgentError, PromptBuilder, agent, defineTool, p, s, toJsonSchema } from "rig";
import { oncePerSession, repair, steering, timeout } from "rig/addons";

beforeEach(() => {
  mocks.createSession.mockClear();
  mocks.approveAll.mockClear();
  mocks.forUri.mockClear();
  mocks.forStdio.mockClear();
  mocks.sdkDefineTool.mockClear();
  mocks.copilotClientCtor.mockClear();
  mocks.disconnectSession.mockClear();
  mocks.stopClient.mockClear();
  mocks.setOnImpl(undefined);
  mocks.setSendAndWaitImpl(async () => JSON.stringify("default"));
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

  it("reuses one client for nested agent invocations while creating model-specific sessions", async () => {
    const child = agent({
      name: "child",
      model: "o3-mini",
      input: s.object({ text: s.string }),
      output: s.object({ text: s.string }),
    });
    const parent = agent({
      name: "parent",
      model: "gpt-4.1",
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
    expect(mocks.copilotClientCtor).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).toHaveBeenCalledTimes(2);
    expect(mocks.createSession.mock.calls).toEqual([
      [{ model: "gpt-4.1", streaming: false, onPermissionRequest: mocks.approveAll }],
      [{ model: "o3-mini", streaming: false, onPermissionRequest: mocks.approveAll }],
    ]);
    expect(mocks.disconnectSession).toHaveBeenCalledTimes(2);
    expect(mocks.stopClient).toHaveBeenCalledTimes(1);
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
      type: "rig.copilot-ask",
      data: { prompt: expect.stringContaining("Hi") },
    });
  });

  it("exposes the Copilot session through an addon", async () => {
    const addon = vi.fn(async (context, next) => {
      await next();
      expect(context.session).toMatchObject({
        sendAndWait: expect.any(Function),
        disconnect: expect.any(Function),
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
      "Agent addon entries must be functions.",
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
      addons: repair,
      maxTurns: 2,
    });

    await expect(repairable("go")).resolves.toBe("repaired");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("<repair");
    expect(prompts[1]).toContain("invalid JSON");
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
        repair,
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

  it("supports per-call model overrides", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const call = agent({ name: "model-test", model: "gpt-4.1" });
    await call("x", { model: "o3-mini" });

    expect(mocks.createSession).toHaveBeenCalledWith({ model: "o3-mini", streaming: false, onPermissionRequest: mocks.approveAll });
  });

  it("passes systemMessage to the session when specified", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const systemMessage = { content: "You are a helpful assistant." };
    const call = agent({ name: "sys-msg-test", systemMessage });
    await call("x");

    expect(mocks.createSession).toHaveBeenCalledWith({
      model: "gpt-4.1",
      streaming: false,
      onPermissionRequest: mocks.approveAll,
      systemMessage,
    });
  });

  it("does not pass systemMessage when not specified", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));

    const call = agent({ name: "no-sys-msg-test" });
    await call("x");

    expect(mocks.createSession).toHaveBeenCalledWith({ model: "gpt-4.1", streaming: false, onPermissionRequest: mocks.approveAll });
  });

  it("defines tools with rig schemas using the Copilot SDK helper shape", () => {
    const handler = vi.fn(async ({ issue }: { issue: string }) => `Issue ${issue}`);
    const lookupIssue = defineTool("lookup_issue", {
      description: "Look up an issue by id.",
      parameters: s.object({ issue: s.string }),
      handler,
    });

    expect(mocks.sdkDefineTool).toHaveBeenCalledWith("lookup_issue", {
      description: "Look up an issue by id.",
      parameters: toJsonSchema(s.object({ issue: s.string })),
      handler,
      skipPermission: true,
    });
    expect(lookupIssue).toMatchObject({
      name: "lookup_issue",
      description: "Look up an issue by id.",
      parameters: toJsonSchema(s.object({ issue: s.string })),
      handler,
      skipPermission: true,
    });
  });

  it("preserves explicit tool permission overrides", () => {
    defineTool("lookup_issue", {
      skipPermission: false,
    });

    expect(mocks.sdkDefineTool).toHaveBeenCalledWith("lookup_issue", {
      skipPermission: false,
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
      model: "gpt-4.1",
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
        repair,
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
      addons: [steering(), repair],
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
        repair,
      ],
    });

    await expect(snippetGuard("go")).resolves.toEqual({ code: "```ts\nconst x = 1;\n```" });
  });

  it("rejects non-function addon entries", async () => {
    mocks.setSendAndWaitImpl(async () => JSON.stringify("ok"));
    const guarded = agent({ name: "guarded", addons: [null as unknown as any] as any });
    await expect(guarded("go")).rejects.toThrow(
      "Agent addon entries must be functions.",
    );
  });

  it("registers with the Copilot session once per call", async () => {
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
        oncePerSession(async (session, context) => {
          register(session, context.turn);
        }),
        repair,
      ],
    });

    await expect(review("go")).resolves.toBe("hello world");
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        sendAndWait: expect.any(Function),
        disconnect: expect.any(Function),
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

    expect(diff.mode).toBe("prompt.text");
    expect(testOutput.mode).toBe("prompt.text");
    expect(testOutput.options).toEqual({ cwd: "/tmp/workspace" });
    expect(readme.mode).toBe("prompt.read");
  });

  it("strips AbortSignal from intent options", () => {
    const controller = new AbortController();
    const intent = p.bash("echo hi", { cwd: "/tmp", signal: controller.signal });

    expect(intent.options).toEqual({ cwd: "/tmp" });
  });
});

describe("prompt builder", () => {
  it("exposes prompt helpers on p", () => {
    expect(p.read("README.md").mode).toBe("prompt.read");
    expect(p.bash("git status --short").mode).toBe("prompt.text");
    expect(p.write("README.md", "# Updated\n").mode).toBe("prompt.write");
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
    expect(toJsonSchema(s.boolean)).toEqual({ type: "boolean" });
    expect(toJsonSchema(s.unknown)).toEqual({});
  });

  it("includes description when present", () => {
    expect(toJsonSchema(s.string("A text value"))).toEqual({ type: "string", description: "A text value" });
    expect(toJsonSchema(s.number("A numeric value"))).toEqual({ type: "number", description: "A numeric value" });
  });

  it("converts enum schemas", () => {
    expect(toJsonSchema(s.enum("a", "b", "c"))).toEqual({ enum: ["a", "b", "c"] });
    expect(toJsonSchema(s.enum(["x", "y"], "A choice"))).toEqual({ enum: ["x", "y"], description: "A choice" });
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
