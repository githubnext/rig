import tseslint from "typescript-eslint";
import { rigPlugin } from "./eslint/rig-plugin.js";

export default tseslint.config(
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      rig: rigPlugin,
    },
    rules: {
      "rig/record-object-shape": "error",
    },
  },
);
