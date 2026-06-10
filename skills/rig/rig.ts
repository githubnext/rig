import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { AsyncLocalStorage } from "node:async_hooks";
import { promisify } from "node:util";
import { CopilotClient, RuntimeConnection, approveAll, defineTool as sdkDefineTool } from "@github/copilot-sdk";
import type {
  CopilotClientOptions,
  SystemMessageConfig,
  Tool as CopilotTool,
  ToolHandler,
  ZodSchema,
} from "@github/copilot-sdk";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ValidationResult = { ok: true } | { ok: false; error: string };

export type StringSchema = { type: "string"; description?: string };
export type NumberSchema = { type: "number"; description?: string };
export type BooleanSchema = { type: "boolean"; description?: string };
export type UnknownSchema = { description?: string };
export type ArraySchema<Item extends Schema = Schema> = { type: "array"; items: Item; description?: string };
export type ObjectSchema<Fields extends Record<string, Schema> = Record<string, Schema>> = {
  type: "object";
  properties: Fields;
  description?: string;
};
export type RecordSchema<Value extends Schema = Schema> = { type: "object"; additionalProperties: Value; description?: string };
export type EnumSchema<Values extends readonly Json[] = readonly Json[]> = { enum: Values; description?: string };
const OPTIONAL_SYMBOL: unique symbol = Symbol("rig.optional");
type OptionalMarker = { readonly [OPTIONAL_SYMBOL]: true };
type UnwrapOptional<T> = Omit<T, typeof OPTIONAL_SYMBOL>;
export type OptionalSchema<Inner extends Schema = Schema> = Inner & OptionalMarker;

export type Schema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | UnknownSchema
  | ArraySchema<any>
  | ObjectSchema<any>
  | RecordSchema<any>
  | EnumSchema<any>
  | OptionalSchema<any>;

type SchemaHelperFactory<T extends Schema> = T & ((description?: string) => T);

const SCHEMA_SYMBOL: unique symbol = Symbol("rig.schema");

function markAsSchema<T extends object>(obj: T): T {
  Object.defineProperty(obj, SCHEMA_SYMBOL, { value: true, enumerable: false, writable: false, configurable: false });
  Object.defineProperty(obj, "toJSON", {
    value: () => serializeSchema(obj as unknown as Schema),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return obj;
}

function cloneSchema<Inner extends Schema>(schema: Inner, description?: string): Inner {
  const cloned = { ...(schema as Record<PropertyKey, unknown>) } as Inner;
  if (description !== undefined) {
    Object.assign(cloned as object, { description });
  }
  return markAsSchema(cloned as unknown as object) as Inner;
}

function markAsOptional<Inner extends Schema>(schema: Inner): OptionalSchema<Inner> {
  Object.defineProperty(schema, OPTIONAL_SYMBOL, { value: true, enumerable: false, writable: false, configurable: false });
  return schema as OptionalSchema<Inner>;
}

function isOptionalSchema(schema: Schema): schema is OptionalSchema<Schema> {
  return OPTIONAL_SYMBOL in schema;
}

function createTypedPrimitiveSchema<T extends StringSchema | NumberSchema | BooleanSchema>(type: T["type"]): SchemaHelperFactory<T> {
  const base = markAsSchema({ type } as T);
  const factory = Object.assign(
    markAsSchema(((description?: string) => (description === undefined ? base : markAsSchema({ type, description } as T))) as SchemaHelperFactory<T>),
    base,
  );
  return factory;
}

function createUnknownSchema(): SchemaHelperFactory<UnknownSchema> {
  const base: UnknownSchema = markAsSchema({});
  const factory = Object.assign(
    markAsSchema(((description?: string) => (description === undefined ? base : markAsSchema({ description }))) as SchemaHelperFactory<UnknownSchema>),
    base,
  );
  return factory;
}

type EnumSchemaFactory = {
  <const Values extends readonly Json[]>(...values: Values): EnumSchema<Values>;
  <const Values extends readonly Json[]>(values: Values, description: string): EnumSchema<Values>;
};

const createEnumSchema: EnumSchemaFactory = (...args: unknown[]) => {
  const valuesOrTuple = args as readonly Json[];
  if (
    valuesOrTuple.length === 2
    && Array.isArray(valuesOrTuple[0])
    && typeof valuesOrTuple[1] === "string"
  ) {
    const enumValues = valuesOrTuple[0] as readonly Json[];
    const description = valuesOrTuple[1] as string;
    return markAsSchema({ enum: enumValues, description });
  }
  const enumValues = valuesOrTuple as readonly Json[];
  return markAsSchema({ enum: enumValues });
};

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type AgentInputValue<T> =
  T extends readonly (infer Item)[] ? PromptIntent | PromptBuilder | AgentInputValue<Item>[] :
  T extends object ? PromptIntent | PromptBuilder | { [K in keyof T]: AgentInputValue<T[K]> } :
  T | PromptIntent | PromptBuilder;

export type InferSchema<T> =
  T extends OptionalMarker ? InferSchema<UnwrapOptional<T>> | undefined :
  T extends { type: "string" } ? string :
  T extends { type: "number" } ? number :
  T extends { type: "boolean" } ? boolean :
  T extends { enum: infer Values extends readonly unknown[] } ? Values[number] :
  T extends { type: "array"; items: infer Item } ? InferSchema<Item>[] :
  T extends { type: "object"; properties: infer Fields extends Record<string, unknown> } ? Simplify<
    & { [K in keyof Fields as Fields[K] extends OptionalMarker ? never : K]: InferSchema<Fields[K]> }
    & { [K in keyof Fields as Fields[K] extends OptionalMarker ? K : never]?: InferSchema<UnwrapOptional<Fields[K]>> }
  > :
  T extends { type: "object"; additionalProperties: infer Value } ? Record<string, InferSchema<Value>> :
  unknown;

export const s = {
  string: createTypedPrimitiveSchema<StringSchema>("string"),
  number: createTypedPrimitiveSchema<NumberSchema>("number"),
  boolean: createTypedPrimitiveSchema<BooleanSchema>("boolean"),
  unknown: createUnknownSchema(),
  array<Item extends Schema>(items: Item, description?: string): ArraySchema<Item> {
    return description === undefined ? markAsSchema({ type: "array", items }) : markAsSchema({ type: "array", items, description });
  },
  object<Fields extends Record<string, Schema>>(properties: Fields, description?: string): ObjectSchema<Fields> {
    return description === undefined ? markAsSchema({ type: "object", properties }) : markAsSchema({ type: "object", properties, description });
  },
  record<Value extends Schema>(additionalProperties: Value, description?: string): RecordSchema<Value> {
    return description === undefined ? markAsSchema({ type: "object", additionalProperties }) : markAsSchema({ type: "object", additionalProperties, description });
  },
  enum: createEnumSchema,
  optional<Inner extends Schema>(schema: Inner, description?: string): OptionalSchema<Inner> {
    return markAsOptional(cloneSchema(schema, description));
  },
  toJsonSchema,
};

export type JsonSchemaObject = { [key: string]: unknown };

export function toJsonSchema(schema: Schema): JsonSchemaObject {
  return serializeSchema(schema);
}

function serializeSchema(schema: Schema): JsonSchemaObject {
  const { description } = schema;
  const withDescription = (obj: JsonSchemaObject): JsonSchemaObject =>
    description === undefined ? obj : { ...obj, description };
  if ("enum" in schema) {
    return withDescription({ enum: schema.enum });
  }
  if ("items" in schema) {
    return withDescription({ type: "array", items: serializeSchema(schema.items) });
  }
  if ("additionalProperties" in schema) {
    return withDescription({ type: "object", additionalProperties: serializeSchema(schema.additionalProperties) });
  }
  if ("properties" in schema) {
    const properties: Record<string, JsonSchemaObject> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(schema.properties) as [string, Schema][]) {
      properties[key] = serializeSchema(field);
      if (!isOptionalSchema(field)) {
        required.push(key);
      }
    }
    const obj: JsonSchemaObject = { type: "object", properties };
    if (required.length > 0) {
      obj["required"] = required;
    }
    return withDescription(obj);
  }
  if ("type" in schema) {
    return withDescription({ type: schema.type });
  }
  return withDescription({});
}

const defaultStringSchema = s.string;
const defaultName = "agent";

export type CopilotEngineOptions = Omit<CopilotClientOptions, "connection"> & {
  connection?: CopilotClientOptions["connection"];
  server?: boolean;
};

function resolveDefaultCopilotUri(): string {
  return process.env["COPILOT_SDK_URI"] ?? "localhost:7777";
}

export function copilotEngine(options: CopilotEngineOptions = {}): CopilotClient {
  const { server, connection, ...clientOptions } = options;
  return new CopilotClient({
    ...clientOptions,
    connection: connection ?? (server ? RuntimeConnection.forStdio() : RuntimeConnection.forUri(resolveDefaultCopilotUri())),
  });
}

function jsonl(value: unknown): string {
  try {
    return JSON.stringify(value, (_, v) => {
      if (typeof v === "bigint") {
        return v.toString();
      }
      if (v instanceof Error) {
        return { name: v.name, message: v.message, stack: v.stack };
      }
      return v;
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return JSON.stringify(rigEvent("logger.error", { error: reason }));
  }
}

function rigEvent(type: string, data?: unknown): { type: string; data?: unknown } {
  return { type: `rig.${type}`, data };
}

function writeEvent(event: unknown): void {
  process.stderr.write(`${jsonl(event)}\n`);
}

export type CopilotSession = Awaited<ReturnType<CopilotClient["createSession"]>>;
export type AgentAddonContext = {
  spec: NormalizedAgentSpec<any, any>;
  session: CopilotSession;
  input: unknown;
  outputSchema: Schema;
  signal: AbortSignal | undefined;
  turn: number;
  maxTurns: number;
  prompt: string;
  response?: string;
  completed: boolean;
  output?: unknown;
  nextPrompt?: string;
  error?: unknown;
};
export type AgentAddon = (
  context: AgentAddonContext,
  next: () => Promise<void>,
) => void | Promise<void>;
export type Tool<TArgs = unknown> = CopilotTool<TArgs>;
export type ToolParameters<TArgs = unknown> = Schema | ZodSchema<TArgs> | Record<string, unknown>;
export type ToolConfig<TArgs = unknown> = {
  description?: string;
  parameters?: ToolParameters<TArgs>;
  handler?: ToolHandler<TArgs>;
  overridesBuiltInTool?: boolean;
  skipPermission?: boolean;
};

export function defineTool<T = unknown>(name: string, config: ToolConfig<T>): Tool<T> {
  return sdkDefineTool(name, {
    ...normalizeToolConfig(config),
    parameters: normalizeToolParameters(config.parameters),
  });
}

export type AgentSpec<Input extends Schema = StringSchema, Output extends Schema = StringSchema> = {
  name?: string;
  instructions?: string | PromptBuilder;
  input?: Input;
  output?: Output;
  model?: string;
  maxTurns?: number;
  addons?: AgentAddon | AgentAddon[];
  agents?: Record<string, AgentFn<any, any>>;
  systemMessage?: SystemMessageConfig;
  tools?: Tool<any>[];
};
/** Internal normalized variant with a guaranteed resolved name. */
type NormalizedAgentSpec<Input extends Schema = StringSchema, Output extends Schema = StringSchema> = AgentSpec<Input, Output> & { name: string };

export type CallOptions = {
  signal?: AbortSignal;
  timeout?: number;
  model?: string;
  maxTurns?: number;
};

export type LaunchOptions = {
  cwd?: string;
  startServer?: boolean;
  typecheck?: boolean;
};

export type LauncherIo = {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
};

export type AgentFn<Input = unknown, Output = unknown> = ((input: AgentInputValue<Input>, options?: CallOptions) => Promise<Output>) & {
  agentName: string;
  inputSchema: Schema;
  outputSchema: Schema;
  inputShape: Schema;
  outputShape: Schema;
  spec: NormalizedAgentSpec<any, any>;
  _namespace: string;
  use: (addons: AgentAddon | AgentAddon[]) => AgentFn<Input, Output>;
};

export type PromptIntentOptions = {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  purpose?: string;
  signal?: AbortSignal;
};

export type PromptIntent = {
  __rig: "prompt";
  id: string;
  mode: "prompt.text" | "prompt.read" | "prompt.write";
  command?: string;
  path?: string;
  contents?: string;
  options?: Omit<PromptIntentOptions, "signal">;
};

let nextPromptIntentId = 1;

type PromptHelpers = {
  (): PromptBuilder;
  (strings: TemplateStringsArray, ...values: unknown[]): PromptBuilder;
  bash(command: string, options?: PromptIntentOptions): PromptIntent;
  read(path: string, options?: PromptIntentOptions): PromptIntent;
  write(path: string, contents: string, options?: PromptIntentOptions): PromptIntent;
  var<T>(name: string, value: T): PromptVariable<T>;
  region(language: string, body: unknown): string;
};

export type PromptVariable<T = unknown> = {
  __rig: "prompt.var";
  name: string;
  value: T;
};

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as { raw?: unknown })?.raw);
}

function isPromptVariable(value: unknown): value is PromptVariable {
  return !!value && typeof value === "object" && (value as { __rig?: string }).__rig === "prompt.var";
}

function createPromptVariable<T>(name: string, value: T): PromptVariable<T> {
  return { __rig: "prompt.var", name, value };
}

function renderPromptPart(value: unknown): string {
  if (isPromptIntent(value)) {
    return renderPromptIntentValue(value);
  }
  if (value instanceof PromptBuilder) {
    return value.toString();
  }
  if (isPromptVariable(value)) {
    return renderPromptPart(value.value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return json(value);
  }
  return String(value);
}

function renderCodeRegion(language: string, body: unknown): string {
  const content = renderPromptPart(body);
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  return `\`\`\`${language}\n${normalized}\`\`\`\n`;
}

function normalizePromptTemplateText(text: string): string {
  if (!text.includes("\n")) {
    return text;
  }
  const lines = text.split("\n");
  while (lines.length > 0 && lines[0]?.trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    return "";
  }
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^[\t ]*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  if (minIndent <= 0) {
    return lines.join("\n");
  }
  return lines.map((line) => line.slice(minIndent)).join("\n");
}

function promptTemplateDelimiter(strings: TemplateStringsArray): string {
  let delimiter = "\u0000";
  while (strings.some((part) => part.includes(delimiter))) {
    delimiter += "\u0000";
  }
  return delimiter;
}

function promptFactory(): PromptBuilder;
function promptFactory(strings: TemplateStringsArray, ...values: unknown[]): PromptBuilder;
function promptFactory(...args: unknown[]): PromptBuilder {
  if (args.length === 0) {
    return new PromptBuilder();
  }
  if (!isTemplateStringsArray(args[0])) {
    const receivedType = args[0] === null ? "null" : typeof args[0];
    throw new TypeError(`p() expects either no arguments (for builder) or tagged template syntax like p\`...\` (received ${args.length} arg(s), first arg type: ${receivedType})`);
  }
  const strings = args[0];
  const values = args.slice(1);
  const builder = new PromptBuilder();
  const delimiter = promptTemplateDelimiter(strings);
  const normalizedStrings = normalizePromptTemplateText(strings.join(delimiter)).split(delimiter);
  for (let index = 0; index < normalizedStrings.length; index += 1) {
    builder.write(normalizedStrings[index] ?? "");
    if (index < values.length) {
      builder.write(values[index]);
    }
  }
  return builder;
}

export const p: PromptHelpers = Object.assign(
  promptFactory,
  {
    bash(command: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.text", withOptions({ command }, options));
    },
    read(path: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.read", withOptions({ path }, options));
    },
    write(path: string, contents: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.write", withOptions({ path, contents }, options));
    },
    var<T>(name: string, value: T): PromptVariable<T> {
      return createPromptVariable(name, value);
    },
    region(language: string, body: unknown): string {
      return renderCodeRegion(language, body);
    },
  },
);

export class PromptBuilder {
  readonly vars = new Map<string, PromptVariable>();
  private readonly chunks: string[] = [];

  bash(command: string, options?: PromptIntentOptions): PromptIntent {
    return p.bash(command, options);
  }

  read(path: string, options?: PromptIntentOptions): PromptIntent {
    return p.read(path, options);
  }

  file(path: string, contents: string, options?: PromptIntentOptions): PromptIntent {
    return p.write(path, contents, options);
  }

  var<T>(name: string, value: T): PromptVariable<T> {
    const variable = createPromptVariable(name, value);
    this.vars.set(name, variable);
    return variable;
  }

  get<T = unknown>(name: string): T | undefined {
    return this.vars.get(name)?.value as T | undefined;
  }

  write(...values: unknown[]): this {
    this.chunks.push(values.map(renderPromptPart).join(""));
    return this;
  }

  line(...values: unknown[]): this {
    return this.write(...values, "\n");
  }

  region(language: string, body: unknown): this {
    this.chunks.push(renderCodeRegion(language, body));
    return this;
  }

  toString(): string {
    return this.chunks.join("");
  }
}

export class AgentError extends Error {
  readonly kind: "parse" | "validation";
  readonly agent: string;
  readonly turn: number;
  readonly response: string;
  readonly schema: Schema;
  readonly schemaText: string;

  constructor(options: {
    kind: "parse" | "validation";
    agent: string;
    turn: number;
    response: string;
    schema: Schema;
    message: string;
  }) {
    super(options.message);
    this.name = "AgentError";
    this.kind = options.kind;
    this.agent = options.agent;
    this.turn = options.turn;
    this.response = options.response;
    this.schema = options.schema;
    this.schemaText = renderSchema(options.schema);
  }
}

let currentCopilotOptions: CopilotEngineOptions | undefined;
type CopilotRunContext = {
  client: CopilotClient;
};
type CopilotSessionHandle = {
  session: CopilotSession;
  close(): Promise<void>;
};
const copilotRunStorage = new AsyncLocalStorage<CopilotRunContext>();

/**
 * Mounts an engine and executes a rig program file.
 * Relative paths are resolved from `options.cwd` (or process cwd).
 */
export async function launchRigProgram(programPath: string, options: LaunchOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = isAbsolute(programPath) ? programPath : resolve(cwd, programPath);

  configureCopilot(resolveCopilotOptions(cwd, options));
  await import(pathToFileURL(resolvedPath).href);
}

async function readStdin(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
  }
  return chunks.join("");
}

function resolveCopilotOptions(cwd: string, options: LaunchOptions): { workingDirectory: string } | { workingDirectory: string; server: true } {
  return options.startServer ? { workingDirectory: cwd, server: true } : { workingDirectory: cwd };
}

function asRootAgent(value: unknown): AgentFn | undefined {
  if (typeof value !== "function") {
    return undefined;
  }
  const candidate = value as Partial<AgentFn>;
  if (!candidate.inputSchema || !candidate.outputSchema) {
    return undefined;
  }
  return value as AgentFn;
}

/**
 * Normalizes supported launcher root exports to an agent function.
 * Strings and prompt builders are wrapped in a default agent.
 */
function asRootProgram(value: unknown, name: string): AgentFn | undefined {
  const rootAgent = asRootAgent(value);
  if (rootAgent) {
    return rootAgent;
  }
  if (typeof value === "string" || value instanceof PromptBuilder) {
    return agent({ name, instructions: value }) as AgentFn;
  }
  return undefined;
}

function noInputInvocation(agentFn: AgentFn): unknown | undefined {
  const schema = agentFn.inputSchema;
  if ("type" in schema && schema.type === "string") {
    return "";
  }
  if (!("properties" in schema)) {
    return undefined;
  }
  const keys = Object.keys(schema.properties);
  if (keys.length === 0) {
    return {};
  }
  if (
    keys.length === 1
    && "text" in schema.properties
    && "type" in (schema.properties.text as Schema)
    && (schema.properties.text as StringSchema).type === "string"
  ) {
    return { text: "" };
  }
  return undefined;
}

function withInjectedRigImport(programCode: string): string {
  if (/\bfrom\s*["']rig["']/.test(programCode)) {
    return programCode;
  }
  return `import { agent, p, s } from "rig";\n\n${programCode}`;
}

function withInjectedDefaultRootAgent(programCode: string): string {
  if (/\bexport\s+default\b/.test(programCode)) {
    return programCode;
  }
  const firstAgentAssignment = programCode.match(
    /^\s*(?:const|let|var)\s+([$_\p{ID_Start}][$_\p{ID_Continue}]*)\s*=\s*agent\s*\(/mu,
  );
  if (!firstAgentAssignment) {
    return programCode;
  }
  return `${programCode}\n\nexport default ${firstAgentAssignment[1]};\n`;
}

function coerceStdinInput(agentFn: AgentFn, text: string): unknown {
  const schema = agentFn.inputSchema;
  if ("type" in schema && schema.type === "string") {
    return text;
  }
  if ("properties" in schema && "text" in schema.properties) {
    return { text };
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Expected stdin to contain JSON for the root agent input schema.");
  }
}

function renderStdout(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    value
    && typeof value === "object"
    && "text" in value
    && typeof (value as { text: unknown }).text === "string"
  ) {
    return (value as { text: string }).text;
  }
  return JSON.stringify(value);
}

async function typecheckProgram(programPath: string, cwd: string): Promise<void> {
  const execFileAsync = promisify(execFile);
  const skillTsconfigPath = resolve(dirname(fileURLToPath(import.meta.url)), "tsconfig.json");
  const candidateTsconfigPaths = [resolve(cwd, "tsconfig.json"), skillTsconfigPath];
  let baseTsconfigPath: string | undefined;
  for (const tsconfigPath of candidateTsconfigPaths) {
    try {
      await access(tsconfigPath);
      baseTsconfigPath = tsconfigPath;
      break;
    } catch {
      // Try the next candidate.
    }
  }
  if (!baseTsconfigPath) {
    throw new Error(
      `Typecheck mode requires tsconfig.json at one of: ${candidateTsconfigPaths.join(", ")}`,
    );
  }
  const tempRoot = resolve(cwd, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(resolve(tempRoot, "rig-typecheck-"));
  const projectPath = resolve(tempDir, "tsconfig.typecheck.json");
  try {
    await writeFile(projectPath, JSON.stringify({
      extends: baseTsconfigPath,
      include: [programPath],
    }), "utf8");
    await execFileAsync(
      "npx",
      ["--yes", "--package", "typescript@5.9.3", "--", "tsc", "--project", projectPath, "--pretty", "false"],
      {
        cwd,
        env: { ...process.env, npm_config_ignore_scripts: "true" },
      },
    );
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (execError.code === "ENOENT") {
      throw new Error("Typecheck mode requires `npx tsc` to be available in PATH.");
    }
    const diagnostics = [execError.stdout, execError.stderr]
      .filter((entry) => typeof entry === "string" && entry.trim())
      .join("\n")
      .trim();
    const detail = diagnostics ? `\n${diagnostics}` : "";
    throw new Error(`Typecheck failed for ${programPath}.${detail}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runRootAgentFromStdin(
  programPath: string,
  options: LaunchOptions = {},
  io: LauncherIo,
  scriptName: string,
): Promise<void> {
  const prompt = await readStdin(io.stdin);
  if (!prompt.trim()) {
    throw new Error(`Usage: ${scriptName} <program-file>`);
  }

  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = isAbsolute(programPath) ? programPath : resolve(cwd, programPath);
  if (options.typecheck) {
    await typecheckProgram(resolvedPath, cwd);
  }

  configureCopilot(resolveCopilotOptions(cwd, options));
  const mod = await import(pathToFileURL(resolvedPath).href);
  const rootAgent = asRootProgram(mod.default, "launcher-root");
  if (!rootAgent) {
    throw new Error("Expected program to export a root value (agent, string, or prompt builder) as default export.");
  }

  const result = await rootAgent(coerceStdinInput(rootAgent, prompt));
  io.stdout.write(renderStdout(result));
}

async function runProgramCodeFromStdin(
  options: LaunchOptions = {},
  io: LauncherIo,
  scriptName: string,
): Promise<void> {
  const programCode = await readStdin(io.stdin);
  if (!programCode.trim()) {
    throw new Error(`Usage: ${scriptName} <program-file> [--server] [--typecheck]`);
  }

  const cwd = options.cwd ?? process.cwd();
  const tempRoot = resolve(cwd, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(resolve(tempRoot, "rig-stdin-"));
  const tempProgramPath = resolve(tempDir, "program.ts");
  const transformedProgramCode = withInjectedDefaultRootAgent(withInjectedRigImport(programCode));
  await writeFile(tempProgramPath, transformedProgramCode, "utf8");
  try {
    if (options.typecheck) {
      await typecheckProgram(tempProgramPath, cwd);
    }
    configureCopilot(resolveCopilotOptions(cwd, options));
    const mod = await import(pathToFileURL(tempProgramPath).href);
    const rootAgent = asRootProgram(mod.default, "launcher-inline-root");
    if (!rootAgent) {
      throw new Error("Expected program to export a root value (agent, string, or prompt builder) as default export.");
    }
    const input = noInputInvocation(rootAgent);
    if (input === undefined) {
      throw new Error("Expected stdin program root agent to have no input (omit input or use input: s.object({})).");
    }
    const result = await rootAgent(input);
    io.stdout.write(renderStdout(result));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const launcherHelpArgs = new Set(["--help", "-h", "help", "/help", "/?"]);

function isLauncherHelpArg(arg: string): boolean {
  return launcherHelpArgs.has(arg.toLowerCase());
}

function renderLauncherUsage(scriptName: string): string {
  return [
    `Usage: ${scriptName} [<program-file>] [--server] [--typecheck]`,
    "",
    "Modes:",
    "  <no program-file>  Read a rig program from stdin and run its default root export.",
    "  <program-file>     Read stdin input and run the program file root export.",
    "",
    "Help aliases:",
    "  --help, -h, help, /help, /?",
    "",
    "Examples:",
    `  cat ./program.ts | ${scriptName}`,
    `  cat ./program.ts | ${scriptName} --typecheck`,
    `  echo "Summarize this repository" | ${scriptName} src/program.ts`,
  ].join("\n");
}

export async function runLauncherCli(
  argv: string[] = process.argv.slice(2),
  options: LaunchOptions = {},
  io: LauncherIo = process,
): Promise<void> {
  const scriptName = process.argv[1] ? basename(process.argv[1]) : "launcher";
  if (argv.some(isLauncherHelpArg)) {
    io.stdout.write(`${renderLauncherUsage(scriptName)}\n`);
    return;
  }
  const positionalArgs = argv.filter((arg) => !arg.startsWith("--"));
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const serverFlag = flags.includes("--server");
  const typecheckFlag = flags.includes("--typecheck");
  const unknownFlags = flags.filter((f) => f !== "--server" && f !== "--typecheck");
  if (positionalArgs.length > 1 || unknownFlags.length > 0) {
    throw new Error(`Usage: ${scriptName} <program-file> [--server] [--typecheck]`);
  }
  const mergedOptions: LaunchOptions = {
    ...options,
    ...(serverFlag ? { startServer: true } : {}),
    ...(typecheckFlag ? { typecheck: true } : {}),
  };
  if (positionalArgs.length === 1) {
    await runRootAgentFromStdin(positionalArgs[0]!, mergedOptions, io, scriptName);
    return;
  }
  await runProgramCodeFromStdin(mergedOptions, io, scriptName);
}

export function agent<
  const Input extends Schema = StringSchema,
  const Output extends Schema = StringSchema
>(spec: AgentSpec<Input, Output>): AgentFn<InferSchema<Input>, InferSchema<Output>>;
export function agent(spec: AgentSpec<any, any>): AgentFn<any, any> {
  const normalizedSpec = normalizeSpec(spec);
  const inputSchema = normalizedSpec.input ?? defaultStringSchema;
  const outputSchema = normalizedSpec.output ?? defaultStringSchema;

  const invoke = async (input: unknown, options: CallOptions = {}) => {
    const runtime = resolveCallRuntime(normalizedSpec, options);
    const normalizedInput = normalizeInput(input, inputSchema);
    let prompt = renderPrompt(normalizedSpec, normalizedInput);
    let lastResponse = "";
    const copilot = await createCopilotSession(runtime.model, runtime.systemMessage, runtime.tools);
    let failure: unknown;

    try {
      for (let turn = 1; turn <= runtime.maxTurns; turn += 1) {
        throwIfAborted(runtime.signal);
        const context: AgentAddonContext = {
          spec: normalizedSpec,
          session: copilot.session,
          input: normalizedInput,
          outputSchema,
          signal: runtime.signal,
          turn,
          maxTurns: runtime.maxTurns,
          prompt,
          completed: false,
        };

        await runAgentAddons(runtime.addons, context, async () => {
          lastResponse = await sendCopilotPrompt(copilot.session, context.prompt, context.signal);
          context.response = lastResponse;
        });

        if (context.error !== undefined) {
          throw context.error;
        }
        if (context.completed) {
          return context.output;
        }
        if (context.nextPrompt !== undefined) {
          prompt = context.nextPrompt;
          continue;
        }
        if (context.response !== undefined) {
          const analysis = analyzeResponse(context.response, context.outputSchema, context.spec.name, context.turn);
          if (analysis.ok) {
            return analysis.output;
          }
          throw analysis.error;
        }
        throw new Error(
          `Agent ${normalizedSpec.name}: addons must set context.output with context.completed=true or context.nextPrompt for turn ${turn}.`,
        );
      }
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      try {
        await copilot.close();
      } catch (cleanupError) {
        if (failure === undefined) {
          throw cleanupError;
        }
      }
    }

    throw new Error(`Agent ${normalizedSpec.name} failed after ${runtime.maxTurns} turns. Last response:\n${lastResponse}`);
  };

  const fn = (async (input: unknown, options: CallOptions = {}) => {
    const existingContext = copilotRunStorage.getStore();
    if (existingContext) {
      return invoke(input, options);
    }

    const client = copilotEngine(currentCopilotOptions);
    return copilotRunStorage.run({ client }, async () => {
      let failure: unknown;
      try {
        return await invoke(input, options);
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        try {
          await stopCopilotClient(client);
        } catch (cleanupError) {
          if (failure === undefined) {
            throw cleanupError;
          }
        }
      }
    });
  }) as AgentFn<any, any>;

  fn.agentName = normalizedSpec.name;
  fn.inputSchema = inputSchema;
  fn.outputSchema = outputSchema;
  fn.inputShape = inputSchema;
  fn.outputShape = outputSchema;
  fn.spec = normalizedSpec;
  fn._namespace = normalizedSpec.name;
  fn.use = (addons) => {
    normalizedSpec.addons = [
      ...normalizeAddons(normalizedSpec.addons),
      ...normalizeAddons(addons),
    ];
    return fn;
  };
  return fn;
}

export type AgentFactory = typeof agent;

function validate(value: unknown, schema: Schema): ValidationResult {
  return validateSchema(value, schema, "$", false);
}

function normalizeSpec(specOrName: AgentSpec<any, any>): NormalizedAgentSpec<any, any> {
  const agentName = specOrName.name ?? defaultName;
  const spec: NormalizedAgentSpec<any, any> = {
    name: agentName,
  };
  if (specOrName.instructions !== undefined) spec.instructions = specOrName.instructions;
  if (specOrName.input !== undefined) {
    assertValidSchema(specOrName.input, agentName, "input");
    spec.input = specOrName.input;
  }
  if (specOrName.output !== undefined) {
    assertValidSchema(specOrName.output, agentName, "output");
    spec.output = specOrName.output;
  }
  if (specOrName.model !== undefined) spec.model = specOrName.model;
  if (specOrName.maxTurns !== undefined) spec.maxTurns = specOrName.maxTurns;
  if (specOrName.addons !== undefined) spec.addons = specOrName.addons;
  if (specOrName.agents !== undefined) spec.agents = specOrName.agents;
  if (specOrName.systemMessage !== undefined) spec.systemMessage = specOrName.systemMessage;
  if (specOrName.tools !== undefined) spec.tools = normalizeTools(specOrName.tools, agentName);
  return spec;
}

function normalizeToolParameters<T>(parameters: ToolParameters<T> | undefined): ToolParameters<T> | undefined {
  return parameters !== undefined && isSchema(parameters) ? toJsonSchema(parameters) : parameters;
}

function normalizeToolConfig<T extends { skipPermission?: boolean }>(tool: T): T & { skipPermission: boolean } {
  return {
    ...tool,
    skipPermission: tool.skipPermission ?? true,
  };
}

function normalizeTools(tools: Tool<any>[], agentName: string): Tool<any>[] {
  return tools.map((tool, index) => {
    if (!tool || typeof tool !== "object") {
      throw new Error(`Invalid tool for agent "${agentName}" at tools[${index}]. Expected a tool definition object.`);
    }
    if (typeof tool.name !== "string" || tool.name.length === 0) {
      throw new Error(`Invalid tool for agent "${agentName}" at tools[${index}]. Expected a non-empty tool name.`);
    }
    return {
      ...normalizeToolConfig(tool),
      parameters: normalizeToolParameters(tool.parameters),
    };
  });
}

function normalizeInput(input: unknown, schema: Schema): unknown {
  if (input !== undefined) {
    return input;
  }
  if ("type" in schema && schema.type === "string") {
    return "";
  }
  if ("properties" in schema) {
    return {};
  }
  return input ?? null;
}

function renderPrompt(spec: NormalizedAgentSpec<any, any>, input: unknown): string {
  const value = inlinePromptIntents(input);
  const instructions = renderInstructions(spec.instructions);
  const sections = [
    tag("instructions", instructions.trim()),
    tag("output_schema", renderSchema(spec.output ?? defaultStringSchema)),
    tag("input", json(value)),
  ];

  if (spec.agents && Object.keys(spec.agents).length > 0) {
    sections.push(tag(
      "subagents",
      json(Object.entries(spec.agents).map(([name, subagent]) => ({
        name,
        instructions: subagent.spec.instructions === undefined ? null : renderInstructions(subagent.spec.instructions),
        model: subagent.spec.model ?? null,
        input: renderSchema(subagent.inputSchema),
        output: renderSchema(subagent.outputSchema),
      }))),
    ));
  }

  sections.push(tag("rules", [
    "Return exactly one JSON value.",
    "Do not wrap the JSON in Markdown.",
    "Match the output schema exactly.",
  ].join("\n")));

  return sections.join("\n\n");
}

function renderInstructions(instructions?: AgentSpec<any, any>["instructions"]): string {
  if (instructions === undefined) {
    return "Return only valid JSON matching the output schema.";
  }
  if (typeof instructions === "string") {
    return instructions;
  }
  return instructions.toString();
}

export function defaultRepairPrompt(spec: AgentSpec<any, any>, error: AgentError): string {
  const agentName = spec.name ?? defaultName;
  return [
    `<repair agent="${escapeAttribute(agentName)}" turn="${error.turn}">`,
    tag("instructions", "Your previous response was invalid. Return only corrected JSON."),
    tag("error", error.message),
    tag("output_schema", error.schemaText),
    tag("previous_response", error.response),
    "</repair>",
  ].join("\n\n");
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return { ok: true, value: JSON.parse(fenced[1]) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return { ok: false, error: "No JSON value found." };
  }

  try {
    return { ok: true, value: JSON.parse(objectMatch[0]) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function validateSchema(value: unknown, schema: Schema, path: string, optional: boolean): ValidationResult {
  if ((optional || isOptionalSchema(schema)) && value === undefined) {
    return { ok: true };
  }
  if ("enum" in schema) {
    return schema.enum.some((item: Json) => deepEqual(item, value))
      ? ok()
      : bad(path, schema.enum.map((item: Json) => JSON.stringify(item)).join(" | "), value);
  }
  if ("items" in schema) {
    if (!Array.isArray(value)) {
      return bad(path, "array", value);
    }
    for (let index = 0; index < value.length; index += 1) {
      const result = validateSchema(value[index], schema.items, `${path}[${index}]`, false);
      if (!result.ok) {
        return result;
      }
    }
    return ok();
  }
  if ("properties" in schema) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return bad(path, "object", value);
    }
    for (const [key, fieldSchema] of Object.entries(schema.properties) as [string, Schema][]) {
      const result = validateSchema(
        (value as Record<string, unknown>)[key],
        fieldSchema,
        `${path}.${key}`,
        false,
      );
      if (!result.ok) {
        return result;
      }
    }
    return ok();
  }
  if ("additionalProperties" in schema) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return bad(path, "object", value);
    }
    for (const [key, item] of Object.entries(value as object)) {
      const result = validateSchema(item, schema.additionalProperties, `${path}.${key}`, false);
      if (!result.ok) {
        return result;
      }
    }
    return ok();
  }
  if ("type" in schema) {
    if (schema.type === "string") return typeof value === "string" ? ok() : bad(path, "string", value);
    if (schema.type === "number") return typeof value === "number" ? ok() : bad(path, "number", value);
    if (schema.type === "boolean") return typeof value === "boolean" ? ok() : bad(path, "boolean", value);
  }
  return ok();
}

function renderSchema(schema: Schema): string {
  return json(schema);
}

function inlinePromptIntents<T>(value: T): T {
  const seen = new WeakSet<object>();

  const walk = (current: unknown): unknown => {
    if (current instanceof PromptBuilder) {
      return current.toString();
    }
    if (isPromptIntent(current)) {
      return renderPromptIntentValue(current);
    }
    if (!current || typeof current !== "object") {
      return current;
    }
    if (seen.has(current)) {
      throw new Error("Cannot serialize circular input while preparing prompt.");
    }
    seen.add(current);
    if (Array.isArray(current)) {
      return current.map(walk);
    }
    return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, walk(item)]));
  };

  return walk(value) as T;
}

export type ResponseAnalysisResult = { ok: true; output: unknown } | { ok: false; error: AgentError };

export function analyzeResponse(response: string, outputSchema: Schema, agentName: string, turn: number): ResponseAnalysisResult {
  const parsed = parseJson(response);
  if (!parsed.ok) {
    return {
      ok: false,
      error: new AgentError({
        kind: "parse",
        agent: agentName,
        turn,
        response,
        schema: outputSchema,
        message: `Agent ${agentName} returned invalid JSON: ${parsed.error}`,
      }),
    };
  }

  const result = validate(parsed.value, outputSchema);
  if (!result.ok) {
    return {
      ok: false,
      error: new AgentError({
        kind: "validation",
        agent: agentName,
        turn,
        response,
        schema: outputSchema,
        message: `Agent ${agentName} output validation failed: ${result.error}`,
      }),
    };
  }

  return { ok: true, output: parsed.value };
}

function renderPromptIntentInstruction(intent: PromptIntent): string {
  const options = formatPromptIntentOptions(intent.options);
  switch (intent.mode) {
    case "prompt.text":
      return `Run bash command and return stdout as text: ${intent.command}${promptExecutionContext()}${options}`;
    case "prompt.read":
      return `Read file and return its contents as text: ${JSON.stringify(requiredPath(intent))}${promptExecutionContext()}${options}`;
    case "prompt.write":
      return `Write file at path ${JSON.stringify(requiredPath(intent))} with contents:\n${intent.contents ?? ""}${promptExecutionContext()}${options}`;
    default:
      throw new Error(`Unsupported prompt intent mode: ${(intent as { mode?: string }).mode ?? "unknown"}`);
  }
}

function promptExecutionContext(): string {
  return "\nRig runs inside a sandboxed agentic workflow. Execute this action directly without asking for extra permission or confirmation.";
}

function formatPromptIntentOptions(options: PromptIntent["options"]): string {
  return options ? `\nOptions: ${json(options)}` : "";
}

function requiredPath(intent: PromptIntent): string {
  if (!intent.path) {
    throw new Error(`Prompt intent mode ${intent.mode} requires a path.`);
  }
  return intent.path;
}

function createPromptIntent(
  mode: PromptIntent["mode"],
  args: Omit<Partial<PromptIntent>, "__rig" | "id" | "mode">,
): PromptIntent {
  return { __rig: "prompt", id: `prompt_intent_${nextPromptIntentId++}`, mode, ...args };
}

function stripSignal(options: PromptIntentOptions): Omit<PromptIntentOptions, "signal"> {
  const { signal: _signal, ...rest } = options;
  return rest;
}

function withOptions<T extends Omit<Partial<PromptIntent>, "__rig" | "id" | "mode">>(
  value: T,
  options?: PromptIntentOptions,
): T | (T & { options: Omit<PromptIntentOptions, "signal"> }) {
  return options ? { ...value, options: stripSignal(options) } : value;
}

function configureCopilot(options: CopilotEngineOptions): void {
  currentCopilotOptions = options;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function throwCleanupErrors(errors: Error[], message: string): void {
  if (errors.length === 1) {
    throw errors[0]!;
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, message);
  }
}

async function stopCopilotClient(client: CopilotClient): Promise<void> {
  const errors: Error[] = [];

  try {
    const stopErrors = await client.stop();
    if (Array.isArray(stopErrors)) {
      errors.push(...stopErrors.map(asError));
    }
  } catch (error) {
    errors.push(asError(error));
  }

  throwCleanupErrors(errors, "Failed to stop Copilot client");
}

async function createCopilotSession(
  model: string,
  systemMessage?: SystemMessageConfig,
  tools?: Tool<any>[],
): Promise<CopilotSessionHandle> {
  const runContext = copilotRunStorage.getStore();
  const client = runContext?.client;
  if (!client) {
    throw new Error("No Copilot client found in execution context. Invoke agents through the exported agent function.");
  }
  const config = {
    model,
    streaming: false,
    onPermissionRequest: approveAll,
    ...(systemMessage !== undefined && { systemMessage }),
    ...(tools !== undefined && { tools }),
  };
  const session = await client.createSession(config);
  session.on?.((event: unknown) => {
    writeEvent(event);
  });

  return {
    session,
    async close() {
      const errors: Error[] = [];

      if (session.disconnect) {
        try {
          await session.disconnect();
        } catch (error) {
          errors.push(asError(error));
        }
      }

      throwCleanupErrors(errors, "Failed to close Copilot session");
    },
  };
}

async function sendCopilotPrompt(session: CopilotSession, prompt: string, signal?: AbortSignal): Promise<string> {
  const request = signal ? { prompt, signal } : { prompt };
  writeEvent(rigEvent("copilot-ask", { prompt }));
  const response = await session.sendAndWait(request);
  if (!response) {
    return "";
  }
  if (typeof response === "string") {
    return response;
  }
  const value = response as any;
  return value?.data?.content ?? value?.data?.text ?? value?.text ?? value?.content ?? JSON.stringify(response);
}

function resolveCallRuntime(spec: NormalizedAgentSpec<any, any>, options: CallOptions): {
  model: string;
  maxTurns: number;
  signal: AbortSignal | undefined;
  addons: AgentAddon[];
  systemMessage: SystemMessageConfig | undefined;
  tools: Tool<any>[] | undefined;
} {
  return {
    model: options.model ?? spec.model ?? "gpt-4.1",
    maxTurns: options.maxTurns ?? spec.maxTurns ?? 4,
    signal: timeoutSignal(options.signal, options.timeout),
    addons: normalizeAddons(spec.addons),
    systemMessage: spec.systemMessage,
    tools: spec.tools,
  };
}

function normalizeAddons(addons?: AgentAddon | AgentAddon[]): AgentAddon[] {
  if (!addons) {
    return [];
  }
  const items = Array.isArray(addons) ? [...addons] : [addons];
  for (const addon of items) {
    if (typeof addon !== "function") {
      throw new Error("Agent addon entries must be functions.");
    }
  }
  return items;
}

async function runAgentAddons(
  addons: AgentAddon[],
  context: AgentAddonContext,
  terminal: () => Promise<void>,
): Promise<void> {
  let index = -1;
  const dispatch = async (current: number): Promise<void> => {
    if (current <= index) {
      throw new Error(`Agent ${context.spec.name} addon at index ${current} called next() multiple times.`);
    }
    index = current;
    const addon = addons[current];
    if (addon === undefined) {
      await terminal();
      return;
    }
    await addon(context, () => dispatch(current + 1));
  };
  await dispatch(0);
}

function isSchema(value: unknown): value is Schema {
  return !!value && (typeof value === "object" || typeof value === "function") && SCHEMA_SYMBOL in value;
}

function assertValidSchema(schema: Schema, agentName: string, slot: "input" | "output", path: string = slot): void {
  if (!isSchema(schema)) {
    throw new Error(`Invalid ${slot} schema for agent "${agentName}" at ${path}. Use declarative s.* schema helpers.`);
  }
  if ("items" in schema) {
    assertValidSchema(schema.items, agentName, slot, `${path}[]`);
    return;
  }
  if ("additionalProperties" in schema) {
    assertValidSchema(schema.additionalProperties, agentName, slot, `${path}.*`);
    return;
  }
  if ("properties" in schema) {
    for (const [key, value] of Object.entries(schema.properties) as [string, Schema][]) {
      assertValidSchema(value, agentName, slot, `${path}.${key}`);
    }
  }
}

function isPromptIntent(value: unknown): value is PromptIntent {
  return !!value
    && typeof value === "object"
    && (value as { __rig?: unknown }).__rig === "prompt"
    && typeof (value as { mode?: unknown }).mode === "string";
}

function renderPromptIntentValue(intent: PromptIntent): string {
  return renderPromptIntentInstruction(intent);
}

function ok(): ValidationResult {
  return { ok: true };
}

function bad(path: string, expected: string, actual: unknown): ValidationResult {
  const actualType = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
  return { ok: false, error: `${path}: expected ${expected}, got ${actualType}` };
}

function tag(name: string, value: string): string {
  return `<${name}>\n${value}\n</${name}>`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}

function timeoutSignal(parent?: AbortSignal, timeout?: number): AbortSignal | undefined {
  if (!timeout) {
    return parent;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${timeout}ms`)), timeout);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  runLauncherCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
