import { createInterface } from "node:readline";

const sessions = new Map<string, string[]>();
let serial = 0;

function send(value: object): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const request: {
    id: number;
    method: string;
    params: { sessionId: string; contentBlocks: { text: string }[] };
  } = JSON.parse(line);
  if (request.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: { serverInfo: { name: "deepseek-harness-sdk-runtime", version: "test" } },
    });
  } else if (request.method === "shutdown") {
    send({ jsonrpc: "2.0", id: request.id, result: {} });
    process.exitCode = 0;
    process.stdin.destroy();
  } else if (request.method === "session/prompt") {
    const { sessionId, contentBlocks } = request.params;
    const messageId = `message-${++serial}`;
    const history = sessions.get(sessionId) ?? [];
    history.push(contentBlocks.map((block: { text: string }) => block.text).join(""));
    sessions.set(sessionId, history);
    send({ jsonrpc: "2.0", id: request.id, result: { messageId } });
    send({
      jsonrpc: "2.0",
      method: "session.event",
      params: {
        sessionId,
        event: { type: "agent/inbox/spliced", data: { inserted: [{ id: messageId }] } },
      },
    });
    if (history.at(-1) === "wait") {
      send({ jsonrpc: "2.0", method: "session.status", params: { sessionId, status: "running" } });
      return;
    }
    for (const event of [
      { type: "assistant/message", data: { message: { content: [{ type: "text", text: history.join("|") }] } } },
      { type: "turn/end", data: { turn: history.length, reason: { kind: "completed" } } },
    ]) {
      send({ jsonrpc: "2.0", method: "session.event", params: { sessionId, event } });
    }
    send({ jsonrpc: "2.0", method: "session.status", params: { sessionId, status: "idle" } });
  } else {
    send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Unknown method" } });
  }
});
