import { describe, expect, it } from "vitest";
import { fixSource, lintSource } from "../skills/rig/eslint/lint.js";
import agentsMustBeObjectRule from "../skills/rig/eslint/rules/agents-must-be-object.js";
import rule from "../skills/rig/eslint/rules/no-object-literal-record.js";
import repairNoArgsRule from "../skills/rig/eslint/rules/repair-no-args.js";

describe("agents-must-be-object", () => {
  it.each([
    "agents: { extractor }",
    "agents: { diagnose, fix }",
    "agents: { a, b, c }",
    "const text = 'agents: [extractor]';",
    // Non-identifier elements must not be flagged (no safe autofix)
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "agents-must-be-object");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "agents: [extractor]",
      "agents: { extractor }",
    ],
    [
      "agents: [diagnose, fix]",
      "agents: { diagnose, fix }",
    ],
    [
      "const x = agent({ model: \"small\", agents: [summarizer] });",
      "const x = agent({ model: \"small\", agents: { summarizer } });",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "agents-must-be-object");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "agents: [extractor]";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "agents-must-be-object")).toEqual([]);
  });

  it("does not flag empty array", () => {
    const source = "agents: []";
    const problems = lintSource(source).filter((p) => p.kind === "agents-must-be-object");
    expect(problems).toEqual([]);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = agentsMustBeObjectRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      key: { type: "Identifier", name: "agents" },
      value: {
        type: "ArrayExpression",
        elements: [
          { type: "Identifier", name: "extractor" },
          { type: "Identifier", name: "summarizer" },
        ],
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("mustBeObject");
    expect(reports[0].fix({ replaceText: (_node, text) => text }))
      .toBe("{ extractor, summarizer }");
  });

  it("does not flag agents object", () => {
    const reports = [];
    const visitor = agentsMustBeObjectRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      key: { type: "Identifier", name: "agents" },
      value: {
        type: "ObjectExpression",
        properties: [],
      },
    });

    expect(reports).toHaveLength(0);
  });

  it("does not flag array with non-identifier elements", () => {
    const reports = [];
    const visitor = agentsMustBeObjectRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      key: { type: "Identifier", name: "agents" },
      value: {
        type: "ArrayExpression",
        elements: [
          { type: "CallExpression" },
        ],
      },
    });

    expect(reports).toHaveLength(0);
  });
});

describe("no-object-literal-record", () => {
  it.each([
    "const output = s.record(s.object({ count: s.number }));",
    "const output = s.nonEmptyObject(s.object({ count: s.number }));",
    "const output = s.record(s.string);",
    "const output = other.record({ count: s.number });",
    "const output = config.s.record({ count: s.number });",
    "const text = 's.record({ count: s.number })';",
  ])("accepts %s", (source) => {
    expect(lintSource(source)).toEqual([]);
  });

  it.each([
    [
      "const output = s.record({ count: s.number });",
      "const output = s.record(s.object({ count: s.number }));",
    ],
    [
      "const output = s.nonEmptyObject(/* value */ { count: s.number });",
      "const output = s.nonEmptyObject(/* value */ s.object({ count: s.number }));",
    ],
    [
      "const output = s.record(({ count: s.number }));",
      "const output = s.record((s.object({ count: s.number })));",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source);
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const object = { type: "ObjectExpression" };
    const visitor = rule.create({
      sourceCode: { getText: () => "{ count: s.number }" },
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "s" },
        property: { type: "Identifier", name: "record" },
      },
      arguments: [object],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("wrapObject");
    expect(reports[0].fix({ replaceText: (_node, text) => text }))
      .toBe("s.object({ count: s.number })");
  });
});

describe("repair-no-args", () => {
  it.each([
    "addons: repair()",
    "addons: [repair()]",
    "addons: [steering(), repair()]",
    "const text = 'repair({ maxTurns: 3 })';",
    "foo.repair({ maxTurns: 3 })",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "repair-no-args");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "addons: repair({ maxTurns: 3 })",
      "addons: repair()",
    ],
    [
      "addons: [steering(), repair({ maxTurns: 2 })]",
      "addons: [steering(), repair()]",
    ],
    [
      "addons: repair({ message: 'retry', maxTurns: 5 })",
      "addons: repair()",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "repair-no-args");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "addons: repair({ maxTurns: 3 })";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "repair-no-args")).toEqual([]);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = repairNoArgsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: { type: "Identifier", name: "repair" },
      arguments: [{ type: "ObjectExpression" }],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("noArgs");
    expect(reports[0].fix({ replaceText: (_node, text) => text }))
      .toBe("repair()");
  });

  it("does not flag repair() with no args", () => {
    const reports = [];
    const visitor = repairNoArgsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: { type: "Identifier", name: "repair" },
      arguments: [],
    });

    expect(reports).toHaveLength(0);
  });
});
