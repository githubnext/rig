import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpcClientCtor = vi.fn();
  const RpcClient = function (this: unknown, options: unknown) {
    rpcClientCtor(options);
    return {};
  };
  return { rpcClientCtor, RpcClient };
});

vi.mock("@earendil-works/pi-coding-agent", () => ({
  RpcClient: mocks.RpcClient,
}));

import { piEngine } from "rig";

beforeEach(() => {
  mocks.rpcClientCtor.mockClear();
});

it("creates a Pi RPC client with ephemeral approved sessions", () => {
  piEngine({ cwd: "/tmp/rig", model: "github-copilot/gpt-5" });

  expect(mocks.rpcClientCtor).toHaveBeenCalledWith({
    cwd: "/tmp/rig",
    model: "github-copilot/gpt-5",
    cliPath: expect.stringMatching(/pi-coding-agent.+cli\.js$/),
    args: ["--no-session", "--approve"],
  });
});

it("preserves explicit Pi client options and arguments", () => {
  piEngine({
    cliPath: "/opt/pi/cli.js",
    cwd: "/tmp/rig",
    provider: "anthropic",
    args: ["--offline"],
  });

  expect(mocks.rpcClientCtor).toHaveBeenCalledWith({
    cliPath: "/opt/pi/cli.js",
    cwd: "/tmp/rig",
    provider: "anthropic",
    args: ["--no-session", "--approve", "--offline"],
  });
});
