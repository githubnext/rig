import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpcClientCtor = vi.fn();
  const start = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  const RpcClient = function (this: unknown, options: unknown) {
    rpcClientCtor(options);
    const eventHandlers = new Set<(event: unknown) => void>();
    return {
      start,
      stop,
      abort: vi.fn(async () => {}),
      onEvent: (handler: (event: unknown) => void) => {
        eventHandlers.add(handler);
        return () => eventHandlers.delete(handler);
      },
      prompt: vi.fn(async () => {
        for (const handler of eventHandlers) {
          handler({ type: "agent_settled" });
        }
      }),
      getLastAssistantText: vi.fn(async () => JSON.stringify("default-mounted")),
    };
  };
  return { rpcClientCtor, start, stop, RpcClient };
});

vi.mock("@earendil-works/pi-coding-agent", () => ({
  RpcClient: mocks.RpcClient,
}));

import { agent, launchRigProgram, s } from "rig";

it("uses the launcher cwd when mounting the default Pi engine", async () => {
  const cwd = "/tmp/workspace/pelikhan/rig/src";
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  await launchRigProgram(fixturePath, { cwd });

  const call = agent({
    name: "launcher-default-engine-test",
    input: s.object({}),
  });
  const result = await call({});
  expect(result).toBe("default-mounted");
  expect(mocks.rpcClientCtor).toHaveBeenCalledWith(expect.objectContaining({ cwd }));
});
