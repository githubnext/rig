import defineToolArgCountRule from "../skills/rig/eslint/rules/define-tool-arg-count.js";
import { describe, expect, it } from "vitest";
import { fixSource, lintSource } from "../skills/rig/eslint/lint.js";
import agentsMustBeObjectRule from "../skills/rig/eslint/rules/agents-must-be-object.js";
import rule from "../skills/rig/eslint/rules/no-object-literal-record.js";
import repairNoArgsRule from "../skills/rig/eslint/rules/repair-no-args.js";
import addonOrderRule from "../skills/rig/eslint/rules/addon-order.js";
import noImplicitAnyRule from "../skills/rig/eslint/rules/no-implicit-any-in-tool-handler.js";
import preferPGlobRule from "../skills/rig/eslint/rules/prefer-p-glob-over-bash-find.js";
import noInvalidAgentFieldsRule from "../skills/rig/eslint/rules/no-invalid-agent-fields.js";
import enumReturnNeedsAsConstRule from "../skills/rig/eslint/rules/enum-return-needs-as-const.js";
import workflowContextImportsRule from "../skills/rig/eslint/rules/workflow-context-imports.js";
import intForCountFieldsRule from "../skills/rig/eslint/rules/int-for-count-fields.js";

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
    const problems = lintSource(source).filter((p) => p.kind === "no-object-literal-record");
    expect(problems).toEqual([]);
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
    const problems = lintSource(source).filter((p) => p.kind === "no-object-literal-record");
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

describe("addon-order", () => {
  it.each([
    "addons: [steering(), repair()]",
    "addons: [steering({ message: \"Final turn\" }), repair()]",
    "addons: repair()",
    "addons: [repair()]",
    "const text = 'addons: [repair(), steering()]';",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "addon-order");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "addons: [repair(), steering()]",
      "addons: [steering(), repair()]",
    ],
    [
      "addons: [repair(), steering({ message: \"Final turn\" })]",
      "addons: [steering({ message: \"Final turn\" }), repair()]",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "addon-order");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "addons: [repair(), steering()]";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "addon-order")).toEqual([]);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = addonOrderRule.create({
      sourceCode: {
        getText: (node) => node.text,
      },
      report: (problem) => reports.push(problem),
    });

    const repairCall = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "repair" },
      arguments: [],
      text: "repair()",
    };
    const steeringCall = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "steering" },
      arguments: [],
      text: "steering()",
    };

    visitor.Property({
      type: "Property",
      key: { type: "Identifier", name: "addons" },
      value: { type: "ArrayExpression", elements: [repairCall, steeringCall] },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("order");
    expect(reports[0].fix({
      replaceText: (_node, text) => text,
    })).toBe("[steering(), repair()]");
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

describe("prefer-p-glob-over-bash-find", () => {
  it.each([
    // Complex find predicates — not flagged
    "files: p.bash(\"find . -name '*.ts' -not -path '*/node_modules/*'\")",
    "files: p.bash(\"find . -name '*.ts' | sort\")",
    "files: p.bash(\"find . -type f -name '*.ts'\")",
    "files: p.bash(\"find . -maxdepth 2 -name '*.ts'\")",
    "files: p.bash(\"find . -name '*.ts' -o -name '*.js'\")",
    // Non-find bash commands — not flagged
    "files: p.bash(\"git diff\")",
    "files: p.bash(\"npm test\")",
    // Member expression — not flagged
    "foo.p.bash(\"find . -name '*.ts'\")",
    // Inside a string literal — not tokenized
    "const text = 'p.bash(\"find . -name \\\"*.ts\\\"\")';",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "prefer-p-glob-over-bash-find");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "files: p.bash(\"find . -name '*.ts'\")",
      'files: p.glob("**/*.ts")',
    ],
    [
      "files: p.bash(\"find src -name '*.ts'\")",
      'files: p.glob("src/**/*.ts")',
    ],
    [
      "files: p.bash(\"find . -name '*.md'\")",
      'files: p.glob("**/*.md")',
    ],
    [
      "files: p.bash('find . -name \"*.ts\"')",
      'files: p.glob("**/*.ts")',
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "prefer-p-glob-over-bash-find");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "files: p.bash(\"find . -name '*.ts'\")";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "prefer-p-glob-over-bash-find")).toEqual([]);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = preferPGlobRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "p" },
        property: { type: "Identifier", name: "bash" },
      },
      arguments: [{ type: "Literal", value: "find . -name '*.ts'", raw: "\"find . -name '*.ts'\"" }],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("preferGlob");
    expect(reports[0].data).toEqual({ glob: "**/*.ts" });
    expect(reports[0].fix({ replaceText: (_node, text) => text })).toBe('p.glob("**/*.ts")');
  });

  it("does not flag complex find commands via ESLint rule", () => {
    const reports = [];
    const visitor = preferPGlobRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "p" },
        property: { type: "Identifier", name: "bash" },
      },
      arguments: [{ type: "Literal", value: "find . -name '*.ts' -not -path '*/node_modules/*'", raw: "\"find . -name '*.ts' -not -path '*/node_modules/*'\"" }],
    });

    expect(reports).toHaveLength(0);
  });
});

describe("no-invalid-agent-fields", () => {
  it.each([
    // All valid fields
    "const a = agent({ name: \"a\", instructions: p`x`, input: s.string, output: s.string, model: \"small\", maxTurns: 4, addons: repair(), agents: { sub }, systemMessage: \"\", tools: [] });",
    // Subset of valid fields
    "const a = agent({ model: \"small\", output: s.string });",
    // agent as a key (not a call) — must not be flagged
    "const x = { agent: { instructions2: 1 } };",
    // Method call obj.agent() — must not be flagged
    "const x = obj.agent({ instructions2: \"x\" });",
    // Inside string
    "const text = 'agent({ instructions2: 1 })';",
    // Computed key — not flagged
    "const a = agent({ [key]: value });",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "no-invalid-agent-fields");
    expect(problems).toEqual([]);
  });

  it.each([
    "const a = agent({ instructions2: p`x` });",
    "const a = agent({ model: \"small\", instruction: p`x` });",
    "const a = agent({ desciption: \"typo\" });",
  ])("flags %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "no-invalid-agent-fields");
    expect(problems).toHaveLength(1);
  });

  it("flags multiple invalid fields in one agent call", () => {
    const source = "const a = agent({ instructions2: p`x`, modell: \"small\" });";
    const problems = lintSource(source).filter((p) => p.kind === "no-invalid-agent-fields");
    expect(problems).toHaveLength(2);
  });

  it("does not autofix (no edits)", () => {
    const source = "const a = agent({ instructions2: p`x` });";
    const problems = lintSource(source).filter((p) => p.kind === "no-invalid-agent-fields");
    expect(problems[0].edits).toEqual([]);
    expect(fixSource(source, problems)).toBe(source);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = noInvalidAgentFieldsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: { type: "Identifier", name: "agent" },
      arguments: [
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "Property",
              computed: false,
              key: { type: "Identifier", name: "instructions2" },
              value: { type: "Literal", value: "x" },
            },
            {
              type: "Property",
              computed: false,
              key: { type: "Identifier", name: "model" },
              value: { type: "Literal", value: "small" },
            },
          ],
        },
      ],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("invalidField");
    expect(reports[0].data.field).toBe("instructions2");
  });

  it("does not flag valid agent fields via ESLint rule", () => {
    const reports = [];
    const visitor = noInvalidAgentFieldsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: { type: "Identifier", name: "agent" },
      arguments: [
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "Property",
              computed: false,
              key: { type: "Identifier", name: "instructions" },
              value: { type: "Literal", value: "x" },
            },
          ],
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });

  it("does not flag member-expression agent calls via ESLint rule", () => {
    const reports = [];
    const visitor = noInvalidAgentFieldsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.CallExpression({
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "obj" },
        property: { type: "Identifier", name: "agent" },
      },
      arguments: [
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "Property",
              computed: false,
              key: { type: "Identifier", name: "instructions2" },
              value: { type: "Literal", value: "x" },
            },
          ],
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });
});

describe("enum-return-needs-as-const", () => {
  // This rule is ESLint-only: the tokenizer cannot track scope to limit
  // the check to handler: property bodies. The ESLint rule walks ancestors
  // to verify the return is inside a handler function.

  function makeHandlerReturn(raw, value = "stable") {
    const retNode = {
      type: "ReturnStatement",
      argument: { type: "Literal", value, raw },
    };
    // Build ancestor chain: BlockStatement → ArrowFunctionExpression → Property(handler)
    retNode.parent = {
      type: "BlockStatement",
      parent: {
        type: "ArrowFunctionExpression",
        parent: {
          type: "Property",
          computed: false,
          key: { type: "Identifier", name: "handler" },
        },
      },
    };
    return retNode;
  }

  it("flags a bare string literal return inside a handler", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.ReturnStatement(makeHandlerReturn("\"stable\""));

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("needsAsConst");
    expect(reports[0].fix({ replaceText: (_node, text) => text }))
      .toBe("\"stable\" as const");
  });

  it("flags single-quoted string literals inside a handler", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.ReturnStatement(makeHandlerReturn("'missing'", "missing"));

    expect(reports).toHaveLength(1);
    expect(reports[0].fix({ replaceText: (_node, text) => text }))
      .toBe("'missing' as const");
  });

  it("does not flag a non-string return inside a handler", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    const retNode = { type: "ReturnStatement", argument: { type: "Literal", value: 42, raw: "42" } };
    retNode.parent = {
      type: "BlockStatement",
      parent: {
        type: "ArrowFunctionExpression",
        parent: {
          type: "Property",
          computed: false,
          key: { type: "Identifier", name: "handler" },
        },
      },
    };
    visitor.ReturnStatement(retNode);

    expect(reports).toHaveLength(0);
  });

  it("does not flag return outside a handler (top-level function)", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    const retNode = {
      type: "ReturnStatement",
      argument: { type: "Literal", value: "stable", raw: "\"stable\"" },
      parent: {
        type: "BlockStatement",
        parent: {
          type: "FunctionDeclaration",
          parent: null,
        },
      },
    };
    visitor.ReturnStatement(retNode);

    expect(reports).toHaveLength(0);
  });

  it("does not flag return inside a non-handler property function", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    const retNode = {
      type: "ReturnStatement",
      argument: { type: "Literal", value: "stable", raw: "\"stable\"" },
      parent: {
        type: "BlockStatement",
        parent: {
          type: "ArrowFunctionExpression",
          parent: {
            type: "Property",
            computed: false,
            key: { type: "Identifier", name: "transform" },
          },
        },
      },
    };
    visitor.ReturnStatement(retNode);

    expect(reports).toHaveLength(0);
  });

  it("does not flag return when argument is not a literal (e.g. identifier)", () => {
    const reports = [];
    const visitor = enumReturnNeedsAsConstRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    const retNode = {
      type: "ReturnStatement",
      argument: { type: "Identifier", name: "value" },
      parent: {
        type: "BlockStatement",
        parent: {
          type: "ArrowFunctionExpression",
          parent: {
            type: "Property",
            computed: false,
            key: { type: "Identifier", name: "handler" },
          },
        },
      },
    };
    visitor.ReturnStatement(retNode);

    expect(reports).toHaveLength(0);
  });
});

describe("workflow-context-imports", () => {
  it.each([
    // Valid: no workflow-context names imported from "rig"
    "import { agent, s, p } from \"rig\";",
    "import { workflow, repair } from \"rig\";",
    // call/pipeline/parallel imported from another module — not flagged
    "import { call, pipeline, parallel } from \"other\";",
    // call as a local alias target (foo as call) — not flagged
    "import { foo as call } from \"rig\";",
    // Inside a string — not tokenized
    "const text = 'import { call } from \"rig\"';",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "workflow-context-imports");
    expect(problems).toEqual([]);
  });

  it.each([
    "import { call } from \"rig\";",
    "import { pipeline } from \"rig\";",
    "import { parallel } from \"rig\";",
    "import { agent, call } from \"rig\";",
  ])("flags %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "workflow-context-imports");
    expect(problems).toHaveLength(1);
  });

  it("flags multiple workflow-context names in one import", () => {
    const source = "import { call, pipeline, parallel } from \"rig\";";
    const problems = lintSource(source).filter((p) => p.kind === "workflow-context-imports");
    expect(problems).toHaveLength(3);
  });

  it("does not autofix (no edits)", () => {
    const source = "import { call } from \"rig\";";
    const problems = lintSource(source).filter((p) => p.kind === "workflow-context-imports");
    expect(problems[0].edits).toEqual([]);
    expect(fixSource(source, problems)).toBe(source);
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = workflowContextImportsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.ImportDeclaration({
      source: { value: "rig" },
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "call" },
          local: { type: "Identifier", name: "call" },
        },
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "agent" },
          local: { type: "Identifier", name: "agent" },
        },
      ],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("notExported");
    expect(reports[0].data.name).toBe("call");
  });

  it("does not flag non-rig imports via ESLint rule", () => {
    const reports = [];
    const visitor = workflowContextImportsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.ImportDeclaration({
      source: { value: "other-module" },
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "call" },
          local: { type: "Identifier", name: "call" },
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });

  it("does not flag alias target via ESLint rule", () => {
    const reports = [];
    const visitor = workflowContextImportsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    // import { foo as call } from "rig" — "foo" is the imported name, not "call"
    visitor.ImportDeclaration({
      source: { value: "rig" },
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "foo" },
          local: { type: "Identifier", name: "call" },
        },
      ],
    });

    expect(reports).toHaveLength(0);
  });
});

describe("int-for-count-fields", () => {
  it.each([
    // Already using s.int — not flagged
    "const output = s.object({ totalFiles: s.int });",
    "const output = s.object({ missingCount: s.int });",
    // Field name does not match the pattern — not flagged
    "const output = s.object({ score: s.number });",
    "const output = s.object({ ratio: s.number });",
    "const output = s.object({ percentage: s.number });",
    // Inside a string
    "const text = 'totalFiles: s.number';",
  ])("accepts %s", (source) => {
    const problems = lintSource(source).filter((p) => p.kind === "int-for-count-fields");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "const output = s.object({ totalFiles: s.number });",
      "const output = s.object({ totalFiles: s.int });",
    ],
    [
      "const output = s.object({ missingCount: s.number });",
      "const output = s.object({ missingCount: s.int });",
    ],
    [
      "const output = s.object({ lineCount: s.number });",
      "const output = s.object({ lineCount: s.int });",
    ],
    [
      "const output = s.object({ totalLines: s.number });",
      "const output = s.object({ totalLines: s.int });",
    ],
    [
      "const output = s.object({ itemCount: s.number });",
      "const output = s.object({ itemCount: s.int });",
    ],
    [
      "const output = s.object({ totalLength: s.number });",
      "const output = s.object({ totalLength: s.int });",
    ],
  ])("fixes %s", (source, expected) => {
    const problems = lintSource(source).filter((p) => p.kind === "int-for-count-fields");
    expect(problems).toHaveLength(1);
    expect(fixSource(source, problems)).toBe(expected);
  });

  it("is idempotent", () => {
    const source = "const output = s.object({ totalFiles: s.number });";
    const once = fixSource(source);
    const twice = fixSource(once);
    expect(twice).toBe(once);
    expect(lintSource(once).filter((p) => p.kind === "int-for-count-fields")).toEqual([]);
  });

  it("flags multiple count fields in one object", () => {
    const source = "const output = s.object({ fileCount: s.number, totalLines: s.number });";
    const problems = lintSource(source).filter((p) => p.kind === "int-for-count-fields");
    expect(problems).toHaveLength(2);
    expect(fixSource(source, problems)).toBe("const output = s.object({ fileCount: s.int, totalLines: s.int });");
  });

  it("keeps the ESLint rule aligned", () => {
    const reports = [];
    const visitor = intForCountFieldsRule.create({
      sourceCode: {
        getText: () => "s.number",
      },
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      computed: false,
      key: { type: "Identifier", name: "totalFiles" },
      value: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "s" },
        property: { type: "Identifier", name: "number" },
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe("useInt");
    expect(reports[0].data.field).toBe("totalFiles");
    expect(reports[0].fix({ replaceText: (_node, text) => text })).toBe("s.int");
  });

  it("does not flag non-count fields via ESLint rule", () => {
    const reports = [];
    const visitor = intForCountFieldsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      computed: false,
      key: { type: "Identifier", name: "score" },
      value: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "s" },
        property: { type: "Identifier", name: "number" },
      },
    });

    expect(reports).toHaveLength(0);
  });

  it("does not flag s.int for count fields via ESLint rule", () => {
    const reports = [];
    const visitor = intForCountFieldsRule.create({
      sourceCode: {},
      report: (problem) => reports.push(problem),
    });

    visitor.Property({
      computed: false,
      key: { type: "Identifier", name: "totalFiles" },
      value: {
        type: "MemberExpression",
        computed: false,
        object: { type: "Identifier", name: "s" },
        property: { type: "Identifier", name: "int" },
      },
    });

    expect(reports).toHaveLength(0);
  });
});
