import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^rig$/, replacement: resolve(__dirname, "skills/rig/rig.ts") },
      { find: /^rig\/engines\/anthropic$/, replacement: resolve(__dirname, "skills/rig/engines/anthropic.ts") },
      { find: /^rig\/engines\/pi$/, replacement: resolve(__dirname, "skills/rig/engines/pi.ts") },
      { find: /^rig\/(.*)$/, replacement: resolve(__dirname, "src/$1") },
    ],
  },
});
