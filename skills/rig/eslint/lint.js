#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanTokens as scanNoObjectLiteralRecord } from "./rules/no-object-literal-record.js";
import { scanTokens as scanRepairNoArgs } from "./rules/repair-no-args.js";

const ignoredDirectories = new Set([".git", "node_modules"]);
const tokenRules = [scanNoObjectLiteralRecord, scanRepairNoArgs];

function tokenize(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const start = index;
    const char = source[index];
    const next = source[index + 1];

    if (/\s/.test(char)) {
      index += 1;
    } else if (char === "/" && next === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
    } else if (char === "/" && next === "*") {
      index = source.indexOf("*/", index + 2);
      index = index === -1 ? source.length : index + 2;
    } else if (char === "'" || char === "\"" || char === "`") {
      const quote = char;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
        } else if (source[index] === quote) {
          index += 1;
          break;
        } else {
          index += 1;
        }
      }
    } else if (/[A-Za-z_$]/.test(char)) {
      index += 1;
      while (index < source.length && /[\w$]/.test(source[index])) index += 1;
      tokens.push({ value: source.slice(start, index), start, end: index });
    } else {
      index += 1;
      tokens.push({ value: char, start, end: index });
    }
  }

  return tokens;
}

export function lintSource(source) {
  const tokens = tokenize(source);
  return tokenRules.flatMap((scan) => scan(tokens));
}

export function fixSource(source, problems = lintSource(source)) {
  let fixed = source;
  const edits = problems.flatMap((problem) => problem.edits ?? []);
  edits.sort((left, right) => right.start - left.start);
  for (const edit of edits) {
    if (edit.end !== undefined) {
      fixed = `${fixed.slice(0, edit.start)}${edit.text}${fixed.slice(edit.end)}`;
    } else {
      fixed = `${fixed.slice(0, edit.start)}${edit.text}${fixed.slice(edit.start)}`;
    }
  }
  return fixed;
}

async function sourceFiles(paths) {
  const files = [];
  for (const path of paths) {
    const entries = await readdir(path, { withFileTypes: true }).catch(() => undefined);
    if (!entries) {
      if (extname(path) === ".ts") files.push(path);
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) files.push(...await sourceFiles([child]));
      else if (extname(entry.name) === ".ts") files.push(child);
    }
  }
  return files;
}

async function main(argv) {
  const fix = argv.includes("--fix");
  const paths = argv.filter((arg) => arg !== "--fix").map((path) => resolve(path));
  if (paths.length === 0) {
    throw new Error("Usage: node skills/rig/eslint/lint.js [--fix] <file-or-directory> [...]");
  }

  let failures = 0;
  for (const file of await sourceFiles(paths)) {
    const source = await readFile(file, "utf8");
    const problems = lintSource(source);
    if (problems.length === 0) continue;
    if (fix) {
      await writeFile(file, fixSource(source, problems));
      continue;
    }
    failures += problems.length;
    for (const problem of problems) {
      const line = source.slice(0, problem.start).split("\n").length;
      console.error(`${file}:${line}: ${problem.message}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
