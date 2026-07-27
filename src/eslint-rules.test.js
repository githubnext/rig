import defineToolArgCountRule from "../skills/rig/eslint/rules/define-tool-arg-count.js";
import { describe, expect, it } from "vitest";
import { fixSource, lintSource } from "../skills/rig/eslint/lint.js";
import agentsMustBeObjectRule from "../skills/rig/eslint/rules/agents-must-be-object.js";
import rule from "../skills/rig/eslint/rules/no-object-literal-record.js";
import repairNoArgsRule from "../skills/rig/eslint/rules/repair-no-args.js";
import noImplicitAnyRule from "../skills/rig/eslint/rules/no-implicit-any-in-tool-handler.js";

describe("define-tool-arg-count", () => {
  it.each([
    "const tool = defineTool(\"echo\", { handler: () => \"ok\" });",
    "const tool = defineTool(\"echo\", { description: \"Echo text.\", parameters: s.object({ text: s.string }), handler: ({ text }) => text });",
    "other.defineTool(\"echo\", \"desc\", schema, schema, handler);",
    "const text = 'defineTool(\"echo\", \"desc\", schema, schema, handler)';",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "define-tool-arg-count");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "const tool = defineTool(\"echo\", \"Echo text.\", s.object({ text: s.string }), s.object({ echoed: s.string }), ({ text }) => ({ echoed: text }));",
      "const tool = defineTool(\"echo\", { description: \"Echo text.\", parameters: s.object({ text: s.string }), handler: ({ text }) => ({ echoed: text }) });",
    ],
    [
      "defineTool(\"lookup_issue\", \"Look up an issue.\", params, result, handler)",
      "defineTool(\"lookup_issue\", { description: \"Look up an issue.\", parameters: params, handler: handler })",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "define-tool-arg-count");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("reports ambiguous arg counts without autofixing", () => {
    const source = "const tool = defineTool(\"echo\", \"Echo text.\", handler);";
    const [problem] = lintSource(source).filter((p) => p.kind === "define-tool-arg-count");
    expect(problem).toBeTruthy();
    expect(problem.edits).toEqual([]);
    expect(fixSource(source, [problem])).toBe(source);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = defineToolArgCountRule.create({
      sourceCode: {
        getText: (node) => node.text,
      },
      report: (problem) => reports.push(problem),
    });

    const args = [
      { type: "Literal", text: "\"echo\"", range: [0, 6] },
      { type: "Literal", text: "\"Echo text.\"", range: [8, 20] },
      { type: "Identifier", text: "params", range: [22, 28] },
      { type: "Identifier", text: "result", range: [30, 36] },
      { type: "Identifier", text: "handler", range: [38, 45] },
    ];
    visitor.CallExpression({
      type: "CallExpression",
      callee: { type: "Identifier", name: "defineTool" },
      arguments: args,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("argCount");
    expect(reports[0].fix({
      replaceTextRange: (_range, text) => text,
    })).toBe(" { description: \"Echo text.\", parameters: params, handler: handler }");
  });
});

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

describe("no-implicit-any-in-tool-handler", () => {
  it.each([
    // Already parenthesized — no flag
    "lines.map((line) => line.trim())",
    "lines.map((line: string) => line.trim())",
    // Destructured — no flag (already needs parens)
    "lines.map(({ a }) => a)",
    // Named function reference — no flag
    "lines.map(Number)",
    // async arrow — no flag (async keyword precedes the param name)
    "lines.map(async line => line.trim())",
    // Method not in the array-methods set
    "lines.reduce((acc, x) => acc + x, 0)",
    // Inside a string literal — not tokenized
    "const text = 'lines.map(line => line.trim())';",
    // Not a bare function call (method on object) — still flagged by design, but let's confirm the object receiver is irrelevant
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "no-implicit-any-in-tool-handler");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "handler: ({ content }) => content.split(\"\\n\").map(line => line.trim())",
      "handler: ({ content }) => content.split(\"\\n\").map((line) => line.trim())",
    ],
    [
      "lines.filter(l => l !== l.trimEnd())",
      "lines.filter((l) => l !== l.trimEnd())",
    ],
    [
      "files.forEach(f => process(f))",
      "files.forEach((f) => process(f))",
    ],
    [
      "items.find(i => i.startsWith(\"prefix\"))",
      "items.find((i) => i.startsWith(\"prefix\"))",
    ],
    [
      "arr.some(x => x > 0)",
      "arr.some((x) => x > 0)",
    ],
    [
      "arr.every(x => x > 0)",
      "arr.every((x) => x > 0)",
    ],
    [
      "arr.flatMap(x => [x, x])",
      "arr.flatMap((x) => [x, x])",
    ],
    [
      "arr.findIndex(x => x === 0)",
      "arr.findIndex((x) => x === 0)",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "no-implicit-any-in-tool-handler");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "lines.map(line => line.trim())";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "no-implicit-any-in-tool-handler")).toEqual([]);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const param = { type: "Identifier", name: "line", typeAnnotation: undefined };
    const visitor = noImplicitAnyRule.create({
      sourceCode: { getText: (node) => node.name },
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "lines" },
        property: { type: "Identifier", name: "map" },
      },
      arguments: [
        {
          type: "ArrowFunctionExpression",
          params: [param],
        },
      ],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("noType");
    expect(reports[0].data).toEqual({ name: "line" });
    expect(reports[0].fix({ replaceText: (_node, text) => text })).toBe("(line)");
  });

  it("does not flag already-typed arrow param", () => {
    const reports = [];
    const visitor = noImplicitAnyRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "lines" },
        property: { type: "Identifier", name: "map" },
      },
      arguments: [
        {
          type: "ArrowFunctionExpression",
          params: [{ type: "Identifier", name: "line", typeAnnotation: { type: "TSTypeAnnotation" } }],
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });

  it("does not flag destructured arrow param", () => {
    const reports = [];
    const visitor = noImplicitAnyRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "lines" },
        property: { type: "Identifier", name: "map" },
      },
      arguments: [
        {
          type: "ArrowFunctionExpression",
          params: [{ type: "ObjectPattern", properties: [] }],
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });
});
