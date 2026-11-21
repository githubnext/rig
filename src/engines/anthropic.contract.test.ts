import { expect, it, vi } from "vitest";
import type { ClientOptions } from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta";
import { defineTool, s } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

it("round-trips a tool call and retains the completed turn through the real Anthropic SDK", async () => {
  const baseURL = "https://anthropic.test";
  const model = "small";
  const toolCall = { type: "tool_use", id: "toolu_test", name: "echo", input: { value: "ping" } } as const;
  const firstAnswer = { type: "text", text: '{"answer":"ping"}', citations: null } as const;
  const replies = [
    { content: [toolCall], stop_reason: "tool_use" },
    { content: [firstAnswer], stop_reason: "end_turn" },
    { content: [{ type: "text", text: "You said ping.", citations: null }], stop_reason: "end_turn" },
  ] satisfies Pick<BetaMessage, "content" | "stop_reason">[];

  // Stub only the HTTP transport; the SDK builds, parses, and advances every request.
  const requests: unknown[] = [];
  const fetch: NonNullable<ClientOptions["fetch"]> = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe(`${baseURL}/v1/messages`);
    expect(request.method).toBe("POST");

    const reply = replies[requests.length];
    if (!reply) throw new Error("Unexpected extra Anthropic request");
    requests.push(await request.json());
    return Response.json({
      ...reply,
      id: `msg_test_${requests.length}`,
      type: "message",
      role: "assistant",
      model,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  };

  const handler = vi.fn(({ value }: { value: string }) => ({ echoed: value }));
  const runtime = await anthropicEngine({
    apiKey: "not-a-real-key",
    baseURL,
    fetch,
    logLevel: "off",
    maxRetries: 0,
    maxTokens: 128,
    maxIterations: 2,
  })({
    model,
    systemMessage: "Be concise.",
    tools: [defineTool("echo", {
      description: "Echo a value",
      parameters: s.object({ value: s.string }),
      handler,
    })],
  });

  const outputSchema = {
    type: "object",
    properties: { answer: { type: "string" } },
    required: ["answer"],
  };
  const prompt = { role: "user", content: "Echo ping." };
  const toolExchange = [
    prompt,
    { role: "assistant", content: [toolCall] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: toolCall.id, content: '{"echoed":"ping"}' }] },
  ];

  try {
    await expect(runtime.ask(prompt.content, { outputSchema })).resolves.toBe(firstAnswer.text);
    await expect(runtime.ask("What did I say?")).resolves.toBe("You said ping.");
  } finally {
    await runtime.close();
  }

  expect(handler).toHaveBeenCalledExactlyOnceWith({ value: "ping" });
  const outputConfig = {
    format: { type: "json_schema", schema: { ...outputSchema, additionalProperties: false } },
  };
  expect(requests).toEqual([
    expect.objectContaining({
      model,
      system: "Be concise.",
      max_tokens: 128,
      messages: [prompt],
      tools: [{
        type: "custom",
        name: "echo",
        description: "Echo a value",
        input_schema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
        },
      }],
      output_config: outputConfig,
    }),
    expect.objectContaining({ messages: toolExchange, output_config: outputConfig }),
    expect.objectContaining({
      messages: [
        ...toolExchange,
        { role: "assistant", content: [firstAnswer] },
        { role: "user", content: "What did I say?" },
      ],
    }),
  ]);
  for (const request of requests) {
    expect(request).not.toHaveProperty("thread");
  }
  expect(requests[2]).not.toHaveProperty("output_config");
});
