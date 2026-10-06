import { extname } from "node:path";

const javaScriptExtensions = new Set([".js", ".mjs", ".cjs"]);

export function isJavaScriptFile(filePath) {
  return javaScriptExtensions.has(extname(filePath));
}

export function isSupportedSourceFile(filePath) {
  return extname(filePath) === ".ts" || isJavaScriptFile(filePath);
}
