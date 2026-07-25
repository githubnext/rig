import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "../skills/rig/eslint/rules/no-object-literal-record.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
});

ruleTester.run("no-object-literal-record", rule, {
  valid: [
    "const output = s.record(s.object({ count: s.number }));",
    "const output = s.nonEmptyObject(s.object({ count: s.number }));",
    "const output = s.record(s.string);",
    "const output = other.record({ count: s.number });",
  ],
  invalid: [
    {
      code: "const output = s.record({ count: s.number });",
      output: "const output = s.record(s.object({ count: s.number }));",
      errors: [{ messageId: "wrapObject" }],
    },
    {
      code: "const output = s.nonEmptyObject({ count: s.number });",
      output: "const output = s.nonEmptyObject(s.object({ count: s.number }));",
      errors: [{ messageId: "wrapObject" }],
    },
  ],
});
