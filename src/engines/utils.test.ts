import { expect, it } from "vitest";
import { agentLifecycle } from "../../skills/rig/engines/utils.ts";

it("rejects overlapping turns without disturbing the active turn", async () => {
  const lifecycle = agentLifecycle("testEngine");
  let finish: ((value: string) => void) | undefined;
  const first = lifecycle.run(undefined, () => new Promise<string>((resolve) => { finish = resolve; }));

  await expect(lifecycle.run(undefined, async () => "second")).rejects.toThrow("testEngine does not support concurrent turns");
  finish?.("first");
  await expect(first).resolves.toBe("first");
  await expect(lifecycle.run(undefined, async () => "next")).resolves.toBe("next");
});

it("rejects success-shaped results after cancellation", async () => {
  const lifecycle = agentLifecycle("testEngine");
  const controller = new AbortController();

  await expect(lifecycle.run(controller.signal, async () => {
    controller.abort(new Error("cancelled"));
    return "not a successful result";
  })).rejects.toThrow("cancelled");
});

it("releases a turn when execution throws synchronously", async () => {
  const lifecycle = agentLifecycle("testEngine");

  await expect(lifecycle.run(undefined, () => { throw new Error("failed"); })).rejects.toThrow("failed");
  await expect(lifecycle.run(undefined, async () => "next")).resolves.toBe("next");
});
