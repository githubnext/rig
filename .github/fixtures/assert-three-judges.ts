import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { criteria, dummyRequest } from "./three-judges.ts";
import type { Judgment } from "./three-judges.ts";

export function assertThreeJudges(value: unknown, engine: string): void {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected a result object");
  const result = value as Record<string, unknown>;
  assert.equal(result["engine"], engine);
  assert.ok(typeof result["model"] === "string" && result["model"].trim().length > 0);
  if (engine === "codex") assert.equal(result["model"], "gpt-5.3-codex");
  if (engine === "pi") assert.equal(result["model"], "auto");
  if (engine === "gemini") assert.equal(result["model"], "gemini-2.5-flash");
  assert.equal(result["request"], dummyRequest);
  assert.equal(result["modelCalls"], 3);
  assert.equal(result["verdict"], "approve");
  assert.ok(Array.isArray(result["judgments"]));
  const judgments = result["judgments"].map((value: unknown): Judgment => {
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected a judgment object");
    const judgment = value as Record<string, unknown>;
    const criterion = criteria.find((criterion: string) => criterion === judgment["criterion"]);
    const decision = judgment["decision"];
    const reason = judgment["reason"];
    assert.ok(criterion, "Expected a known criterion");
    assert.ok(decision === "approve" || decision === "reject", "Expected approve or reject");
    assert.ok(typeof reason === "string" && reason.trim().length > 0, "Expected a nonempty reason");
    return { criterion, decision, reason };
  });
  assert.deepEqual(judgments.map((judgment: Judgment) => judgment.criterion), criteria);
  assert.ok(judgments.filter((judgment: Judgment) => judgment.decision === "approve").length >= 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  const engine = process.env["RIG_JUDGE_ENGINE"];
  assert.ok(path, "Expected the result file path");
  assert.ok(engine && ["codex", "gemini", "pi"].includes(engine), "Expected RIG_JUDGE_ENGINE");
  const result: unknown = JSON.parse(readFileSync(path, "utf8"));
  assertThreeJudges(result, engine);
  console.log(JSON.stringify(result, null, 2));
}
