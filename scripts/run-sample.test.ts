/**
 * Run a rig sample with a stub Copilot SDK client that returns shape-conforming output.
 * Usage: npx vitest run scripts/run-sample.test.ts -- --sample 02
 *    or: npm run sample -- 02
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { Readable, Writable } from "stream";
import { execFile } from "child_process";
import { promisify } from "util";
import { runLauncherCli } from "rig";

const execFileAsync = promisify(execFile);

const mocks = vi.hoisted(() => {
  const approveAll = vi.fn();
  let sendAndWaitImpl: (request: { prompt: string }) => unknown | Promise<unknown> = async () => ({ text: "stub response" });
  const disconnectSession = vi.fn(async () => {});
  const stopClient = vi.fn(async () => []);
  const createSession = vi.fn(async () => ({
    sendAndWait: async (request: { prompt: string }) => {
      const response = await sendAndWaitImpl(request);
      return JSON.stringify(response);
    },
    disconnect: disconnectSession,
  }));
  const forUri = vi.fn(() => ({ kind: "uri", url: "localhost:7777" }));
  const forStdio = vi.fn(() => ({ kind: "stdio" }));
  const CopilotClient = function () {
    return { createSession, stop: stopClient };
  };
  const setSendAndWaitImpl = (impl: (request: { prompt: string }) => unknown | Promise<unknown>) => {
    sendAndWaitImpl = impl;
  };
  return { approveAll, createSession, disconnectSession, stopClient, forUri, forStdio, CopilotClient, setSendAndWaitImpl };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: mocks.forStdio },
}));

function generateOutput(prompt: string): unknown {
  const match = prompt.match(/<output_schema>([\s\S]*?)<\/output_schema>/);
  if (!match) return { text: "stub response" };
  const schema = match[1].trim();
  try {
    return parseJsonSchema(JSON.parse(schema));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // Backward compatibility with historical schema text format.
  }
  return parseTypeText(schema);
}

const ADDITIONAL_PROPERTIES_STUB_KEY_PREFIX = "example";

function nextAdditionalPropertiesStubKey(result: Record<string, unknown>): string {
  let key = ADDITIONAL_PROPERTIES_STUB_KEY_PREFIX;
  let suffix = 2;
  while (result[key] !== undefined) {
    key = `${ADDITIONAL_PROPERTIES_STUB_KEY_PREFIX}${suffix}`;
    suffix += 1;
  }
  return key;
}

function parseJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return "stub";
  const node = schema as Record<string, unknown>;
  if (Array.isArray(node["enum"]) && node["enum"].length > 0) return node["enum"][0];
  if (Array.isArray(node["oneOf"]) && node["oneOf"].length > 0) return parseJsonSchema(node["oneOf"][0]);
  if (Array.isArray(node["anyOf"]) && node["anyOf"].length > 0) return parseJsonSchema(node["anyOf"][0]);

  switch (node["type"]) {
    case "string":
      return "stub";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "array":
      return [];
    case "object": {
      const properties = node["properties"] && typeof node["properties"] === "object" && !Array.isArray(node["properties"])
        ? node["properties"] as Record<string, unknown>
        : {};
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(properties)) {
        result[key] = parseJsonSchema(value);
      }
      if (node["additionalProperties"]) {
        const fallbackKey = nextAdditionalPropertiesStubKey(result);
        result[fallbackKey] = parseJsonSchema(node["additionalProperties"]);
      }
      return result;
    }
    default:
      if (node["properties"] && typeof node["properties"] === "object" && !Array.isArray(node["properties"])) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node["properties"] as Record<string, unknown>)) {
          result[key] = parseJsonSchema(value);
        }
        return result;
      }
      return "stub";
  }
}

function parseTypeText(text: string): unknown {
  text = text.trim();

  // Union/enum: "value1" | "value2" | ...
  if (text.includes("|") && !text.startsWith("{")) {
    const parts = text.split("|").map((s) => s.trim());
    // Pick first non-null
    for (const p of parts) {
      if (p === "null") continue;
      if (p.startsWith('"') && p.endsWith('"')) return p.slice(1, -1);
      if (p === "string") return "stub";
      if (p === "number") return 0;
      if (p === "boolean") return true;
      return p;
    }
    return null;
  }

  // Array: type[]
  if (text.endsWith("[]")) return [];

  // Primitives
  if (text === "string") return "stub";
  if (text === "number") return 0;
  if (text === "boolean") return true;
  if (text === "unknown") return null;

  // Object: { ... }
  if (text.startsWith("{")) {
    const inner = text.slice(1, text.lastIndexOf("}")).trim();
    if (!inner) return {};
    const result: Record<string, unknown> = {};
    const fields = splitFields(inner);
    for (const field of fields) {
      // [key: string]: type  (wildcard/record)
      const wildcardMatch = field.match(/^\[key:\s*string\]\s*:\s*([\s\S]+?);?\s*$/);
      if (wildcardMatch) {
        result["example"] = parseTypeText(wildcardMatch[1].replace(/;\s*$/, "").trim());
        continue;
      }
      // key?: type;  or  key: type;  (type may be multi-line for nested objects)
      const fieldMatch = field.match(/^(\w+)(\?)?\s*:\s*([\s\S]+?);?\s*$/);
      if (fieldMatch) {
        const [, key, , type] = fieldMatch;
        result[key] = parseTypeText(type.replace(/;\s*$/, "").trim());
      }
    }
    if (Object.keys(result).length === 0) return { text: "stub" };
    return result;
  }

  // Quoted literal
  if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
  // Numeric literal
  if (/^\d+$/.test(text)) return Number(text);
  // Boolean literal
  if (text === "true") return true;
  if (text === "false") return false;

  return "stub";
}

function splitFields(inner: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let current = "";
  for (const line of inner.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    current += (current ? "\n" : "") + trimmed;
    depth += (trimmed.match(/\{/g) || []).length;
    depth -= (trimmed.match(/\}/g) || []).length;
    // A field is complete when we're back to depth 0 and line ends with ;
    if (depth <= 0 && (trimmed.endsWith(";") || trimmed.endsWith("}"))) {
      fields.push(current);
      current = "";
      depth = 0;
    }
  }
  if (current) fields.push(current);
  return fields;
}

// Determine which samples to run
const sampleDir = resolve(__dirname, "../src/samples");
const allFiles = readdirSync(sampleDir)
  .filter((f) => f.endsWith(".ts"))
  .sort();
const markdownDir = resolve(__dirname, "../skills/rig/samples");
const allMarkdownFiles = readdirSync(markdownDir)
  .filter((f) => f.endsWith(".md"))
  .sort();

const filter = process.env["RIG_SAMPLE"];
const targets = filter
  ? allFiles.filter((f) => f.includes(filter))
  : allFiles;
const markdownTargets = filter
  ? allMarkdownFiles.filter((f) => f.includes(filter))
  : allMarkdownFiles;

function extractRigCode(markdown: string): string {
  const match = markdown.match(/```rig\n([\s\S]*?)\n```/);
  if (!match) throw new Error("Expected sample markdown to contain a ```rig code fence.");
  return match[1];
}

function withTypecheckModel(code: string): string {
  return code.replace(/model:\s*"[^"]+"/g, 'model: "typecheck"');
}

beforeEach(() => {
  mocks.createSession.mockClear();
  mocks.setSendAndWaitImpl(async ({ prompt }) => generateOutput(prompt));
});

describe("samples", () => {
  for (const file of targets) {
    it(file, async () => {
      // Dynamically import the sample — vitest resolves "rig" via alias
      // Samples use top-level await so the import itself runs them
      const start = performance.now();
      try {
        await import(`../src/samples/${file}`);
      } catch (e: any) {
        // Timeout/abort errors are expected for samples that test those features
        if (e?.message?.includes("Timed out") || e?.name === "AbortError") {
          // expected
        } else {
          throw e;
        }
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  }
});

describe("skill markdown samples", () => {
  for (const file of markdownTargets) {
    it(file, async () => {
      const code = extractRigCode(readFileSync(resolve(markdownDir, file), "utf8"));
      const runnableCode = withTypecheckModel(code);
      expect(code.split("\n").length).toBeLessThanOrEqual(30);
      expect(code).toContain("export default");
      expect(code).toContain("// Agent role:");
      expect(code).not.toContain("console.log");
      expect((code.match(/^import .* from "rig";$/gm) ?? [])).toHaveLength(1);
      expect(code).not.toMatch(/^await\s+\w+\(/m);

      const stdin = Readable.from([runnableCode]);
      const output: string[] = [];
      const stdout = new Writable({
        write(chunk, _encoding, callback) {
          output.push(chunk.toString());
          callback();
        },
      });

      const start = performance.now();
      await runLauncherCli([], {}, { stdin, stdout });
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5000);
      expect(output.join("")).not.toBe("");
    });
  }
});

describe("skill markdown samples typecheck", () => {
  it("typechecks extracted rig programs with npx tsc", async () => {
    const typecheckDir = await mkdtemp(resolve(tmpdir(), "rig-sample-typecheck-"));
    try {
      for (const file of markdownTargets) {
        const markdown = readFileSync(resolve(markdownDir, file), "utf8");
        const code = withTypecheckModel(extractRigCode(markdown));
        const tsFile = resolve(typecheckDir, file.replace(/\.md$/, ".ts"));
        await writeFile(tsFile, `${code}\n`, "utf8");
      }

      await execFileAsync(
        "npx",
        ["--yes", "--package", "typescript@5.9.3", "--", "tsc", "--noEmit", "--pretty", "false"],
        {
          cwd: resolve(__dirname, ".."),
          env: { ...process.env, npm_config_ignore_scripts: "true" },
        },
      );
    } finally {
      await rm(typecheckDir, { recursive: true, force: true });
    }
  });
});
