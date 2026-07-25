import parser from "@typescript-eslint/parser";
import rig from "rig/eslint";

export default [
  {
    ignores: ["node_modules/"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      rig,
    },
    rules: {
      "rig/no-object-literal-record": "error",
    },
  },
];
