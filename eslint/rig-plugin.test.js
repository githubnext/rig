import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { rigPlugin } from "./rig-plugin.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
});

tester.run("record-object-shape", rigPlugin.rules["record-object-shape"], {
  valid: [
    'import { s } from "rig"; const shape = s.record(s.object({ name: s.string }));',
    'import { s } from "other"; const shape = s.record({ name: s.string });',
    'import { s } from "rig"; const shape = s.object({ name: s.string });',
  ],
  invalid: [
    {
      code: 'import { s } from "rig"; const shape = s.record({ name: s.string });',
      errors: [{ messageId: "wrapObject" }],
      output: 'import { s } from "rig"; const shape = s.record(s.object({ name: s.string }));',
    },
    {
      code: 'import { s as schema } from "rig"; const shape = schema.record({ name: schema.string });',
      errors: [{ messageId: "wrapObject" }],
      output: 'import { s as schema } from "rig"; const shape = schema.record(schema.object({ name: schema.string }));',
    },
  ],
});
