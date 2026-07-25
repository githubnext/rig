import { describe, expect, it } from "vitest";
import { fixSource, lintSource } from "../skills/rig/eslint/lint.js";
import rule from "../skills/rig/eslint/rules/no-object-literal-record.js";

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
