/**
 * @file skills/rig/rig.ts @last-analyzed b88e1d6 @edit-time 2026-07-25T03:20:42Z
 * @purpose Minimal TypeScript multi-agent harness: typed input/output schemas, prompt intents, sub-agent delegation, Copilot SDK runtime
 * @deps @github/copilot-sdk (CopilotClient,RuntimeConnection,approveAll); node:path,url,fs/promises,child_process,util
 * T:Json type null|bool|num|str|Json[]|{[k]:Json}
 * T:Schema type StringSchema|NumberSchema|IntegerSchema|BooleanSchema|NullSchema|UnknownSchema|ArraySchema|ObjectSchema|RecordSchema|EnumSchema|OptionalSchema|NullableSchema [NEW]
 * T:NullableSchema<Inner> type {nullable:true;inner:Inner;description?} accepts inner|null [NEW]
 * T:InferSchema<T> type TS inference from schema descriptor to runtime type
 * T:AgentInputValue<T> type input accepting raw values or PromptIntent/PromptBuilder at any nesting level
 * T:Simplify<T> type flattens intersection types for display
 * T:ValidationResult type {ok:true}|{ok:false;error:string}
 * T:AgentSpec<I,O> type {name,description,input,output,prompt,addons?,maxTurns?,agents?} agent declaration; agents? enables sub-agent delegation
 * T:AgentFn<I,O> type callable agent with .use(addons) and .spec property
 * T:AgentFactory type (options:AgentOptions)=>Agent|Promise<Agent>
 * T:Agent interface {ask(input,opts?):Promise<unknown>,close():Promise<void>}
 * T:AgentAddon type middleware (ctx,next)=>Promise<void>; ctx exposes spec,turn,prompt,output,completed,nextPrompt
 * T:AgentAddonContext type context passed to each addon in the chain
 * T:AgentDefinitionFactory type typeof agent (for passing agent constructor as value)
 * T:AgentError class error carrying kind,agent,turn,response,schema,schemaText fields
 * T:Tool<TArgs> type ToolConfig+name; created by defineTool
 * T:ToolConfig<TArgs> type {description,parameters,handler}
 * T:PromptIntent type declarative placeholder {kind:'bash'|'bashEach'|'read'|'readAll'|'write'|'writeOutput'|'writeInput'|'glob'|'env',…} resolved into prompt text
 * T:PromptBuilder class template-tag result; composes intents+strings into a prompt fragment
 * T:PromptHelpers type shape of exported p object
 * T:PromptVariable<T> type {__rig:'prompt.var';name:string;value:T} named prompt variable [NEW]
 * T:ResponseAnalysisResult type {ok:true;output}|{ok:false;error:AgentError}
 * T:CopilotEngineOptions type CopilotClientOptions minus connection, plus server/token/headers fields
 * T:LaunchOptions type options for launchRigProgram (server,token,headers,cwd,args)
 * T:LauncherIo type {stdin,stdout,stderr} override for launcher subprocess
 * T:JsonSchemaObject type {[key:string]:unknown} plain JSON Schema object
 * T:DebugLogger type lazy category-bound logger controlled by RIG_DEBUG
 * s.string/number/integer/boolean/null SchemaHelperFactory primitives; call as value or fn(desc)
 * s.int alias for s.integer; s.nonEmptyString string with minLength:1; s.url string with format:"uri"; s.path string with format:"path"; s.date string with format:"date" validated as YYYY-MM-DD
 * s.positiveInt integer with minimum:1; s.nonNegativeInt integer with minimum:0; s.percent number with minimum:0,maximum:100; NumberSchema/IntegerSchema support minimum/maximum constraints
 * s.array(items,desc?) ArraySchema; use for homogeneous lists, e.g. s.array(s.string)
 * s.nonEmptyArray(items,desc?) ArraySchema with minItems:1; validates array has at least one element
 * s.object(props,desc?) ObjectSchema; s.optional(inner) marks field optional; s.nullable(inner) accepts inner|null; use for fixed-key shapes
 * s.record(valSchema,desc?) RecordSchema keyed by string; use for open-ended key→value maps
 * s.nonEmptyObject(valSchema,desc?) RecordSchema with minProperties:1; validates record has at least one key
 * s.enum(...values|values,desc) EnumSchema
 * s.literal(value,desc?) EnumSchema with a single value; clearer than s.enum for single-value constraints
 * s.unknown unconstrained JSON; call as value or s.unknown("description")
 * p`...` PromptBuilder template tag; interpolates PromptIntent|string|PromptBuilder
 * p.bash(cmd,opts?) PromptIntent bash execution declaration (not run in-process); escape backslashes as in TS strings
 * p.bashRaw`cmd` PromptIntent bash execution using tagged template (no TypeScript string escape needed)
 * p.read(path,opts?) PromptIntent file read declaration
 * p.readOptional(path,fallback?,opts?) PromptIntent file read declaration; returns fallback (default "") if file absent
 * p.write(path,content,opts?) PromptIntent file write declaration; does NOT expand to path in template — hard-code path in output schema
 * p.writeOutput(field,path,opts?) PromptIntent post-generation write declaration; writes output field value to path
 * p.writeInput(inputPathField,contentOutputField,opts?) PromptIntent post-generation write declaration; writes output field value to the path given by input.<inputPathField> [NEW]
 * p.glob(pattern,opts?) PromptIntent glob file-list declaration (not run in-process)
 * p.readAll(paths,opts?) PromptIntent multi-file read declaration; reads all listed paths and concatenates their contents
 * p.readInput(field,opts?) PromptIntent file read declaration using a runtime input field as the path; reads the file at the single path given by input.<field> [NEW]
 * p.readAllInput(field,opts?) PromptIntent multi-file read declaration using a runtime input array field; reads all paths in input.<field> and concatenates their contents [NEW]
 * p.bashEach(template,inputArrayField,opts?) PromptIntent bash-per-element declaration; runs template once per element in input.<inputArrayField>, substituting {} with each element [NEW]
 * p.env(name,fallback?,opts?) PromptIntent env var read declaration; returns fallback (default "") if not set
 * p.json(value) string JSON.stringify helper for inlining structured values in prompt templates
 * p.inputField(field) string returns "input.<field>" for explicit, documented reference to a caller-supplied input field in prompt prose [NEW]
 * p.var(name,value) PromptVariable<T> named variable binding for prompt templates [NEW]
 * p.region(language,body) string wraps body in a fenced code block for the given language [NEW]
 * F:agent(spec) AgentFn<I,O>; spec={name,description,input,output,prompt,addons,maxTurns}
 * F:copilotEngine(opts?) AgentFactory wrapping CopilotClient+RuntimeConnection
 * F:configureAgent(factory) sets global AgentFactory used by agent() calls at module scope
 * F:launchRigProgram(path,opts?) runs .ts agent file as subprocess via tsx
 * F:runLauncherCli(opts?) entry-point CLI: parses argv, wires copilotEngine, runs agent
 * F:defineTool(name,config) Tool with handler+parameters schema
 * F:analyzeResponse(resp,schema,name,turn) ResponseAnalysisResult parse+validate JSON from raw response text (tries direct parse, then fenced ```json block, then balanced-brace extraction)
 * F:defaultRepairPrompt(spec,err) string re-prompt on parse/validation failure
 * F:toJsonSchema(schema) JsonSchemaObject converts Schema to plain JSON Schema
 * F:debug(category) creates a lazy category-filtered JSONL logger
 * addon:repair re-prompts on JSON/schema failure up to maxTurns (built-in via defaultRepairPrompt)
 * INV:shape-descriptors JS values promote to schemas ("" → string, 0 → number, [""] → string[])
 * INV:optional-key trailing _ on spec key means optional field
 * INV:prompt-intents p.* are declarative placeholders resolved into prompt text, never executed
 * INV:repair-contract addon intercepts AgentError, appends error to prompt, retries up to maxTurns
 * INV:json-extraction model response is parsed directly as JSON; fallback strategies: extract ```json fenced block, then extract first balanced {…}/[…] value
 * INV:schema-symbol Schema objects carry private SCHEMA_SYMBOL; toJSON serializes via serializeSchema
 * INV:p-write-no-path p.write() contributes a write instruction to the prompt; it does NOT return the path; hard-code path in agent output [NEW]
 */
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CopilotClient, RuntimeConnection, approveAll } from "@github/copilot-sdk";
import type { CopilotClientOptions } from "@github/copilot-sdk";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ValidationResult = { ok: true } | { ok: false; error: string };

export type StringSchema = { type: "string"; description?: string; minLength?: number; format?: string };
export type NumberSchema = { type: "number"; description?: string; minimum?: number; maximum?: number };
export type IntegerSchema = { type: "integer"; description?: string; minimum?: number; maximum?: number };
export type BooleanSchema = { type: "boolean"; description?: string };
export type NullSchema = { type: "null"; description?: string };
export type UnknownSchema = { description?: string };
export type ArraySchema<Item extends Schema = Schema> = { type: "array"; items: Item; description?: string; minItems?: number };
export type ObjectSchema<Fields extends Record<string, Schema> = Record<string, Schema>> = {
  type: "object";
  properties: Fields;
  description?: string;
};
export type RecordSchema<Value extends Schema = Schema> = { type: "object"; additionalProperties: Value; description?: string; minProperties?: number };
export type EnumSchema<Values extends readonly Json[] = readonly Json[]> = { enum: Values; description?: string };
const OPTIONAL_SYMBOL: unique symbol = Symbol("rig.optional");
type OptionalMarker = { readonly [OPTIONAL_SYMBOL]: true };
type UnwrapOptional<T> = Omit<T, typeof OPTIONAL_SYMBOL>;
export type OptionalSchema<Inner extends Schema = Schema> = Inner & OptionalMarker;
export type NullableSchema<Inner extends Schema = Schema> = { nullable: true; inner: Inner; description?: string };

export type Schema =
  | StringSchema
  | NumberSchema
  | IntegerSchema
  | BooleanSchema
  | NullSchema
  | UnknownSchema
  | ArraySchema<any>
  | ObjectSchema<any>
  | RecordSchema<any>
  | EnumSchema<any>
  | OptionalSchema<any>
  | NullableSchema<any>;

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

function createTypedPrimitiveSchema<T extends StringSchema | NumberSchema | IntegerSchema | BooleanSchema | NullSchema>(type: T["type"]): SchemaHelperFactory<T> {
  const base = markAsSchema({ type } as T);
  const factory = Object.assign(
    markAsSchema(((description?: string) => (description === undefined ? base : markAsSchema({ type, description } as T))) as SchemaHelperFactory<T>),
    base,
  );
  return factory;
}

function createConstrainedStringSchema(constraint: Omit<StringSchema, "type" | "description">): SchemaHelperFactory<StringSchema> {
  const base = markAsSchema({ type: "string", ...constraint } as StringSchema);
  const factory = Object.assign(
    markAsSchema(((description?: string) => (description === undefined ? base : markAsSchema({ type: "string", ...constraint, description } as StringSchema))) as SchemaHelperFactory<StringSchema>),
    base,
  );
  return factory;
}

function createConstrainedNumberSchema<T extends NumberSchema | IntegerSchema>(constraint: Omit<T, "description">): SchemaHelperFactory<T> {
  const base = markAsSchema({ ...constraint } as T);
  const factory = Object.assign(
    markAsSchema(((description?: string) => (description === undefined ? base : markAsSchema({ ...constraint, description } as T))) as SchemaHelperFactory<T>),
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
  T extends { nullable: true; inner: infer Inner extends Schema } ? InferSchema<Inner> | null :
  T extends OptionalMarker ? InferSchema<UnwrapOptional<T>> | undefined :
  T extends { type: "string" } ? string :
  T extends { type: "number" } ? number :
  T extends { type: "integer" } ? number :
  T extends { type: "boolean" } ? boolean :
  T extends { type: "null" } ? null :
  T extends { enum: infer Values extends readonly unknown[] } ? Values[number] :
  T extends { type: "array"; items: infer Item } ? InferSchema<Item>[] :
  T extends { type: "object"; properties: infer Fields extends Record<string, unknown> } ? Simplify<
    & { [K in keyof Fields as Fields[K] extends OptionalMarker ? never : K]: InferSchema<Fields[K]> }
    & { [K in keyof Fields as Fields[K] extends OptionalMarker ? K : never]?: InferSchema<UnwrapOptional<Fields[K]>> }
  > :
  T extends { type: "object"; additionalProperties: infer Value } ? Record<string, InferSchema<Value>> :
  unknown;

export const s = {
  /** Schema for a `string` value. Call as `s.string` or `s.string("description")`. */
  string: createTypedPrimitiveSchema<StringSchema>("string"),
  /** Schema for a non-empty `string` value (minLength: 1). Call as `s.nonEmptyString` or `s.nonEmptyString("description")`. */
  nonEmptyString: createConstrainedStringSchema({ minLength: 1 }),
  /** Schema for a URL string (format: "uri"). Call as `s.url` or `s.url("description")`. */
  url: createConstrainedStringSchema({ format: "uri" }),
  /** Schema for a file system path string (format: "path"). Use instead of `s.string` when the value is a file or directory path; improves readability and hints to the runtime about path-based context resolution. Call as `s.path` or `s.path("description")`. */
  path: createConstrainedStringSchema({ format: "path" }),
  /** Schema for an ISO 8601 calendar date string (format: "date", pattern `YYYY-MM-DD`). Use when the value is a date-only value (no time component). Validated at runtime: non-conforming strings fail with a clear error. Call as `s.date` or `s.date("description")`. */
  date: createConstrainedStringSchema({ format: "date" }),
  /** Schema for a `number` value. Call as `s.number` or `s.number("description")`. */
  number: createTypedPrimitiveSchema<NumberSchema>("number"),
  /** Schema for an integer value. Serializes to `{"type":"integer"}` in JSON Schema. Call as `s.integer` or `s.integer("description")`. */
  integer: createTypedPrimitiveSchema<IntegerSchema>("integer"),
  /** Schema for an integer value. Alias for `s.integer`. Call as `s.int` or `s.int("description")`. */
  int: createTypedPrimitiveSchema<IntegerSchema>("integer"),
  /** Schema for a positive integer (minimum: 1). Call as `s.positiveInt` or `s.positiveInt("description")`. */
  positiveInt: createConstrainedNumberSchema<IntegerSchema>({ type: "integer", minimum: 1 }),
  /** Schema for a non-negative integer (minimum: 0). Call as `s.nonNegativeInt` or `s.nonNegativeInt("description")`. */
  nonNegativeInt: createConstrainedNumberSchema<IntegerSchema>({ type: "integer", minimum: 0 }),
  /** Schema for a percentage value (number in the range 0–100, inclusive). Use instead of `s.number` when the value is a percentage; validates that the number is between 0 and 100. Call as `s.percent` or `s.percent("description")`. */
  percent: createConstrainedNumberSchema<NumberSchema>({ type: "number", minimum: 0, maximum: 100 }),
  /** Schema for a `boolean` value. Call as `s.boolean` or `s.boolean("description")`. */
  boolean: createTypedPrimitiveSchema<BooleanSchema>("boolean"),
  /** Schema for the JSON `null` literal. Call as `s.null` or `s.null("description")`. */
  null: createTypedPrimitiveSchema<NullSchema>("null"),
  /**
   * Schema for an unconstrained JSON value. Serializes to an empty schema object.
   * Call as `s.unknown` or `s.unknown("description")`.
   *
   * @example
   * s.unknown                      // any JSON value
   * s.unknown("raw API payload")   // any JSON value with description
   */
  unknown: createUnknownSchema(),
  /**
   * Schema for a homogeneous array.
   *
   * @example
   * s.array(s.string)            // string[]
   * s.array(s.number, "scores")  // number[] with description
   */
  array<Item extends Schema>(items: Item, description?: string): ArraySchema<Item> {
    return description === undefined ? markAsSchema({ type: "array", items }) : markAsSchema({ type: "array", items, description });
  },
  /**
   * Schema for a non-empty homogeneous array (minItems: 1). Validates that the array has at least one element.
   *
   * @example
   * s.nonEmptyArray(s.string)            // string[] with at least one element
   * s.nonEmptyArray(s.number, "scores")  // number[] with at least one element and description
   */
  nonEmptyArray<Item extends Schema>(items: Item, description?: string): ArraySchema<Item> {
    return description === undefined
      ? markAsSchema({ type: "array", items, minItems: 1 })
      : markAsSchema({ type: "array", items, minItems: 1, description });
  },
  /**
   * Schema for a fixed-shape object. Fields wrapped with `s.optional` are omitted from `required`.
   *
   * @example
   * s.object({ name: s.string, age: s.optional(s.number) })
   */
  object<Fields extends Record<string, Schema>>(properties: Fields, description?: string): ObjectSchema<Fields> {
    return description === undefined ? markAsSchema({ type: "object", properties }) : markAsSchema({ type: "object", properties, description });
  },
  /**
   * Schema for a string-keyed map where every value shares the same schema.
   * Use this instead of `s.object` when the keys are not known in advance.
   *
   * @example
   * s.record(s.string)                    // Record<string, string>
   * s.record(s.number, "score by name")   // Record<string, number> with description
   */
  record<Value extends Schema>(additionalProperties: Value, description?: string): RecordSchema<Value> {
    return description === undefined ? markAsSchema({ type: "object", additionalProperties }) : markAsSchema({ type: "object", additionalProperties, description });
  },
  /**
   * Schema for a non-empty string-keyed map (minProperties: 1). Validates that the record has at least one key.
   * Use this instead of `s.record` when the map must not be empty.
   *
   * @example
   * s.nonEmptyObject(s.string)                         // Record<string, string> with at least one key
   * s.nonEmptyObject(s.number, "scores by name")       // Record<string, number> with at least one key and description
   */
  nonEmptyObject<Value extends Schema>(additionalProperties: Value, description?: string): RecordSchema<Value> {
    return description === undefined
      ? markAsSchema({ type: "object", additionalProperties, minProperties: 1 })
      : markAsSchema({ type: "object", additionalProperties, minProperties: 1, description });
  },
  /**
   * Schema for a closed set of literal values.
   *
   * @example
   * s.enum("low", "medium", "high")
   * s.enum(["low", "medium", "high"], "Risk level")
   */
  enum: createEnumSchema,
  /**
   * Marks a schema field as optional so it is excluded from the `required` array
   * in the serialized JSON Schema and may be `undefined` in the inferred TypeScript type.
   *
   * @example
   * s.object({ file: s.optional(s.string) })
   */
  optional<Inner extends Schema>(schema: Inner, description?: string): OptionalSchema<Inner> {
    return markAsOptional(cloneSchema(schema, description));
  },
  /**
   * Wraps a schema to also accept `null`. The serialized JSON Schema uses `anyOf`
   * with the inner schema and `{"type":"null"}`. The inferred TypeScript type is
   * `InferSchema<Inner> | null`.
   *
   * @example
   * s.nullable(s.string)                   // string | null
   * s.nullable(s.number, "score or null")  // number | null with description
   */
  nullable<Inner extends Schema>(schema: Inner, description?: string): NullableSchema<Inner> {
    return markAsSchema(description !== undefined
      ? { nullable: true, inner: schema, description }
      : { nullable: true, inner: schema });
  },
  /**
   * Schema for a single exact literal value. More expressive than `s.enum` when
   * only one value is valid. The inferred TypeScript type is the literal itself.
   *
   * @example
   * s.literal("done")               // accepts only "done"; infers as "done"
   * s.literal(42)                   // accepts only 42; infers as 42
   * s.literal(true, "must be true") // with description
   */
  literal<const T extends Json>(value: T, description?: string): EnumSchema<[T]> {
    return markAsSchema(description !== undefined ? { enum: [value], description } : { enum: [value] });
  },
  /** Converts a rig `Schema` to a plain JSON Schema object. */
  toJsonSchema,
};

export type JsonSchemaObject = { [key: string]: unknown };

export function toJsonSchema(schema: Schema): JsonSchemaObject {
  return serializeSchema(schema);
}

function serializeSchema(schema: Schema): JsonSchemaObject {
  const { description } = schema as { description?: string };
  const withDescription = (obj: JsonSchemaObject): JsonSchemaObject =>
    description === undefined ? obj : { ...obj, description };
  if ("nullable" in schema && schema.nullable === true) {
    const inner = serializeSchema((schema as NullableSchema).inner);
    return withDescription({ anyOf: [inner, { type: "null" }] });
  }
  if ("enum" in schema) {
    const enumValues = schema.enum as readonly unknown[];
    const allStrings = enumValues.length > 0 && enumValues.every((v) => typeof v === "string");
    return withDescription(allStrings ? { type: "string", enum: schema.enum } : { enum: schema.enum });
  }
  if ("items" in schema) {
    const arr = schema as ArraySchema;
    const obj: JsonSchemaObject = { type: "array", items: serializeSchema(arr.items) };
    if (arr.minItems !== undefined) obj["minItems"] = arr.minItems;
    return withDescription(obj);
  }
  if ("additionalProperties" in schema) {
    const rec = schema as RecordSchema;
    const obj: JsonSchemaObject = { type: "object", additionalProperties: serializeSchema(rec.additionalProperties) };
    if (rec.minProperties !== undefined) obj["minProperties"] = rec.minProperties;
    return withDescription(obj);
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
    if (schema.type === "string") {
      const { minLength, format } = schema as StringSchema;
      const base: JsonSchemaObject = { type: "string" };
      if (minLength !== undefined) base["minLength"] = minLength;
      if (format !== undefined) base["format"] = format;
      return withDescription(base);
    }
    if (schema.type === "number" || schema.type === "integer") {
      const { minimum, maximum } = schema as NumberSchema | IntegerSchema;
      const base: JsonSchemaObject = { type: schema.type };
      if (minimum !== undefined) base["minimum"] = minimum;
      if (maximum !== undefined) base["maximum"] = maximum;
      return withDescription(base);
    }
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

export type AgentOptions = {
  model: string;
  systemMessage?: unknown;
  tools?: Tool<any>[];
};

export type AgentAskOptions = {
  signal?: AbortSignal;
};

export interface Agent {
  ask(prompt: string, options?: AgentAskOptions): Promise<string>;
  close(): Promise<void>;
}

export type AgentFactory = (options: AgentOptions) => Agent | Promise<Agent>;

function resolveDefaultCopilotUri(): string {
  return process.env["COPILOT_SDK_URI"] ?? "localhost:7777";
}

type DefaultEngineKind = "copilot" | "anthropic" | "codex" | "gemini";

type DefaultEngineOptions = {
  cwd?: string;
  startServer?: boolean;
};

function hasNonEmptyEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function resolveDefaultEngineKind(options: DefaultEngineOptions = {}): DefaultEngineKind {
  if (options.startServer) {
    return "copilot";
  }
  if (hasNonEmptyEnv("COPILOT_SDK_URI")) {
    return "copilot";
  }
  const configuredEngine = process.env["RIG_ENGINE"]?.trim().toLowerCase();
  if (configuredEngine === "copilot" || configuredEngine === "anthropic" || configuredEngine === "codex" || configuredEngine === "gemini") {
    return configuredEngine;
  }
  if (hasNonEmptyEnv("ANTHROPIC_API_KEY")) {
    return "anthropic";
  }
  if (hasNonEmptyEnv("OPENAI_API_KEY")) {
    return "codex";
  }
  if (hasNonEmptyEnv("GEMINI_API_KEY") || hasNonEmptyEnv("GOOGLE_API_KEY")) {
    return "gemini";
  }
  return "copilot";
}

function defaultAgentFactory(options: DefaultEngineOptions = {}): AgentFactory {
  return async (agentOptions) => {
    const kind = resolveDefaultEngineKind(options);
    debugEngineSelect({ kind, model: agentOptions.model });
    if (kind === "anthropic") {
      const { anthropicEngine } = await import("./engines/anthropic.ts");
      return anthropicEngine()(agentOptions);
    }
    if (kind === "codex") {
      const { codexEngine } = await import("./engines/codex.ts");
      return codexEngine(options.cwd ? { thread: { workingDirectory: options.cwd } } : {})(agentOptions);
    }
    if (kind === "gemini") {
      const { geminiEngine } = await import("./engines/gemini.ts");
      return geminiEngine(options.cwd ? { cwd: options.cwd } : {})(agentOptions);
    }
    const copilotOptions = options.cwd
      ? resolveCopilotOptions(options.cwd, options.startServer ? { startServer: true } : {})
      : options.startServer ? { server: true } : {};
    return copilotEngine(copilotOptions)(agentOptions);
  };
}

export function copilotEngine(options: CopilotEngineOptions = {}): AgentFactory {
  const { server, connection, ...clientOptions } = options;
  return async (agentOptions) => {
    debugCopilotCreate({ model: agentOptions.model, transport: connection ? "custom" : server ? "stdio" : "uri" });
    const client = new CopilotClient({
      ...clientOptions,
      connection: connection ?? (server ? RuntimeConnection.forStdio() : RuntimeConnection.forUri(resolveDefaultCopilotUri())),
    });
    const session = await client.createSession({
      model: agentOptions.model,
      streaming: false,
      onPermissionRequest: approveAll,
      ...(agentOptions.systemMessage !== undefined && { systemMessage: agentOptions.systemMessage as any }),
      ...(agentOptions.tools !== undefined && { tools: agentOptions.tools as any }),
    });
    session.on?.((event: unknown) => {
      debugCopilotEvent(() => event);
    });

    return {
      async ask(prompt, askOptions = {}) {
        debugCopilotAsk({ prompt });
        const response = await (session.sendAndWait as any)(
          askOptions.signal ? { prompt, signal: askOptions.signal } : { prompt },
        );
        const text = responseText(response);
        debugCopilotResponse({ response: text });
        return text;
      },
      async close() {
        debugCopilotClose();
        const errors: Error[] = [];
        if (session.disconnect) {
          try {
            await session.disconnect();
          } catch (error) {
            errors.push(asError(error));
          }
        }
        try {
          await stopCopilotClient(client);
        } catch (error) {
          errors.push(asError(error));
        }
        throwCleanupErrors(errors, "Failed to close Copilot agent");
      },
    };
  };
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

function writeDebugLine(line: string): void {
  const buffer = Buffer.from(line);
  let offset = 0;
  while (offset < buffer.length) {
    const written = writeSync(process.stderr.fd, buffer, offset, buffer.length - offset);
    if (written === 0) {
      throw new Error("Unable to write debug event");
    }
    offset += written;
  }
}

export type DebugLogger = {
  (details?: unknown | (() => unknown)): void;
  readonly enabled: boolean;
};

function debugPatternMatches(pattern: string, category: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (!pattern.includes("*")) {
    return category === pattern || category.startsWith(`${pattern}:`);
  }
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`).test(category);
}

function debugEnabled(category: string): boolean {
  const patterns = (process.env["RIG_DEBUG"] ?? "")
    .split(/[\s,]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);
  if (!category || patterns.length === 0) {
    return false;
  }
  const excluded = patterns
    .filter((pattern) => pattern.startsWith("-"))
    .some((pattern) => debugPatternMatches(pattern.slice(1), category));
  if (excluded) {
    return false;
  }
  return patterns
    .filter((pattern) => !pattern.startsWith("-"))
    .some((pattern) => debugPatternMatches(pattern, category));
}

export function debug(category: string): DebugLogger {
  const logger = (details?: unknown | (() => unknown)): void => {
    if (!debugEnabled(category)) {
      return;
    }
    try {
      const data = typeof details === "function" ? details() : details;
      writeDebugLine(`${jsonl(rigEvent(category, data))}\n`);
    } catch {
      // Debugging must not affect rig execution.
    }
  };
  Object.defineProperty(logger, "enabled", { get: () => debugEnabled(category) });
  return logger as DebugLogger;
}

const debugEngineSelect = debug("engine:select");
const debugCopilotCreate = debug("engine:copilot:create");
const debugCopilotEvent = debug("engine:copilot:event");
const debugCopilotAsk = debug("engine:copilot:ask");
const debugCopilotResponse = debug("engine:copilot:response");
const debugCopilotClose = debug("engine:copilot:close");
const debugAgentInvoke = debug("agent:invoke");
const debugAgentTurn = debug("agent:turn");
const debugAgentResponse = debug("agent:response");
const debugAgentError = debug("agent:error");
const debugAgentComplete = debug("agent:complete");
const debugAgentRetry = debug("agent:retry");
const debugAgentFailure = debug("agent:failure");
const debugAgentClose = debug("agent:close");

export type AgentAddonContext = {
  spec: NormalizedAgentSpec<any, any>;
  agent: Agent;
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
/**
 * Middleware function that wraps each agent turn.  Addons are called in
 * declaration order; each must call `await next()` to continue the chain (or
 * the terminal `runtimeAgent.ask`).
 *
 * **Control-flow fields** — set on `context` after `await next()` returns:
 * - `context.completed = true` + `context.output` — short-circuit; return
 *   `output` immediately without further turns.
 * - `context.nextPrompt` — replace the prompt for the next turn; the harness
 *   loops back to turn N+1 with the new prompt.
 * - `context.error` — abort the agent and rethrow this value as the error.
 * - Leave all fields unchanged to let the harness parse and validate
 *   `context.response` with the declared output schema as normal.
 *
 * @example
 * // Custom repair addon: retry up to maxTurns with the schema error appended
 * const repairAddon: AgentAddon = async (ctx, next) => {
 *   await next();
 *   if (ctx.completed || ctx.response === undefined) return;
 *   const analysis = analyzeResponse(ctx.response, ctx.outputSchema, ctx.spec.name, ctx.turn);
 *   if (analysis.ok) {
 *     ctx.completed = true;
 *     ctx.output = analysis.output;
 *   } else if (ctx.turn < ctx.maxTurns) {
 *     ctx.nextPrompt = defaultRepairPrompt(ctx.spec, analysis.error);
 *   } else {
 *     ctx.error = analysis.error;
 *   }
 * };
 */
export type AgentAddon = (
  context: AgentAddonContext,
  next: () => Promise<void>,
) => void | Promise<void>;
export type SteeringOptions = {
  message?: string;
};
export type TimeoutOptions = {
  timeout: number;
};
export type AgentRegistration = (
  agent: Agent,
  context: AgentAddonContext,
) => void | Promise<void>;
export type ToolHandler<TArgs = unknown> = (args: TArgs) => unknown | Promise<unknown>;
export type ToolParameters = Schema | Record<string, unknown>;
export type Tool<TArgs = unknown> = ToolConfig<TArgs> & { name: string };
export type ToolConfig<TArgs = unknown> = {
  description?: string;
  parameters?: ToolParameters;
  handler?: ToolHandler<TArgs>;
  overridesBuiltInTool?: boolean;
  skipPermission?: boolean;
};
type InferToolArgs<TParameters extends ToolParameters> = TParameters extends Schema ? InferSchema<TParameters> : unknown;

export function defineTool<const TParameters extends ToolParameters>(
  name: string,
  config: Omit<ToolConfig<InferToolArgs<TParameters>>, "parameters"> & { parameters: TParameters },
): Tool<InferToolArgs<TParameters>>;
export function defineTool<T = unknown>(name: string, config: ToolConfig<T>): Tool<T>;
export function defineTool(name: string, config: ToolConfig<any>): Tool<any> {
  return {
    name,
    ...normalizeToolConfig(config),
    parameters: normalizeToolParameters(config.parameters),
  };
}

export type AgentSpec<Input extends Schema = StringSchema, Output extends Schema = StringSchema> = {
  /** Human-readable name used in error messages and JSONL event logs. Defaults to `"agent"`. */
  name?: string;
  /** Natural-language task description rendered into the `<instructions>` prompt section. */
  instructions?: string | PromptBuilder;
  /** Schema describing the agent's input value. Defaults to `s.string`. */
  input?: Input;
  /** Schema describing the agent's expected output. The harness validates and retries until it matches. Defaults to `s.string`. */
  output?: Output;
  /** Model identifier passed to the engine, e.g. `"mini"`, `"gpt-5"`, `"claude-sonnet"`. Defaults to `"small"`. */
  model?: string;
  /** Maximum number of turns (initial + repair retries). Defaults to `4`. */
  maxTurns?: number;
  /** Middleware addons that wrap each turn's ask/response cycle, e.g. `repair()`, `steering()`. */
  addons?: AgentAddon | AgentAddon[];
  /** Named sub-agents available for delegation from this agent's prompt. */
  agents?: Record<string, AgentFn<any, any>>;
  /** Optional system message forwarded to the underlying engine session. */
  systemMessage?: unknown;
  /** Tool definitions exposed to the engine session for function-calling. */
  tools?: Tool<any>[];
};
/** Internal normalized variant with a guaranteed resolved name. */
type NormalizedAgentSpec<Input extends Schema = StringSchema, Output extends Schema = StringSchema> = AgentSpec<Input, Output> & { name: string };

export type CallOptions = {
  /** AbortSignal that cancels the in-flight agent turn. Also composable with `timeout`. */
  signal?: AbortSignal;
  /** Milliseconds before the agent turn is automatically aborted with a timeout error. */
  timeout?: number;
  /** Model identifier that overrides the agent's default `model` for this call only. */
  model?: string;
  /** Maximum turns override for this call, taking precedence over the agent's `maxTurns`. */
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
  /** Working directory for the command. Serialized into the `Options` block shown to the LLM. */
  cwd?: string;
  /** Environment variable overrides for the command. Serialized into the `Options` block shown to the LLM. */
  env?: Record<string, string>;
  /** Maximum milliseconds the command may run. Serialized into the `Options` block shown to the LLM. */
  timeout?: number;
  /** Human-readable explanation of why the command is needed. Serialized into the `Options` block shown to the LLM to aid the runtime in understanding intent. */
  purpose?: string;
  /** Abort signal. **Not** serialized into the prompt; used only for in-process cancellation. */
  signal?: AbortSignal;
};

export type PromptIntent = {
  __rig: "prompt";
  id: string;
  mode: "prompt.text" | "prompt.read" | "prompt.write" | "prompt.glob" | "prompt.readOptional" | "prompt.env" | "prompt.writeOutput" | "prompt.writeInput" | "prompt.readAll" | "prompt.readInput" | "prompt.readAllInput" | "prompt.bashEach";
  command?: string;
  path?: string;
  pathField?: string;
  paths?: string[];
  contents?: string;
  pattern?: string;
  fallback?: string;
  field?: string;
  options?: Omit<PromptIntentOptions, "signal">;
};

let nextPromptIntentId = 1;

type PromptHelpers = {
  (): PromptBuilder;
  (strings: TemplateStringsArray, ...values: unknown[]): PromptBuilder;
  /**
   * Declarative intent that instructs the LLM to run `command` in a shell and
   * substitute the stdout into the prompt.  The command is **not** executed
   * in-process by the rig harness; it is expanded into a natural-language
   * instruction that the Copilot runtime resolves when it processes the prompt.
   *
   * Backslashes in the string must be escaped as in any TypeScript string literal
   * (e.g. `"grep -E 'foo\\|bar'"` to match `foo|bar`).  When the command
   * contains many backslashes or regex alternations, use `p.bashRaw\`...\`` to
   * write the command verbatim without any TypeScript escaping.
   *
   * @example
   * input: { diff: p.bash("git diff --stat") }
   * // For commands with backslashes, prefer p.bashRaw:
   * input: { matches: p.bashRaw`grep -rn 'app\.get\|app\.post' src/` }
   */
  bash(command: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to run a shell command, using a
   * tagged template literal to avoid TypeScript string-escape issues with
   * backslashes and special characters.  The command is **not** executed
   * in-process; it is expanded into a natural-language instruction resolved by
   * the Copilot runtime.
   *
   * @example
   * // Avoids double-escaping backslashes in regex patterns:
   * input: { matches: p.bashRaw`grep -rn 'app\.get\|app\.post' src/` }
   */
  bashRaw(strings: TemplateStringsArray, ...values: unknown[]): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read the file at `path` and
   * substitute its contents into the prompt.  The file is **not** read
   * in-process; resolution happens inside the Copilot runtime.
   *
   * @example
   * input: { source: p.read("src/index.ts") }
   */
  read(path: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read the file at `path` if it
   * exists and substitute its contents into the prompt.  If the file does not
   * exist, the `fallback` string (default `""`) is used instead.  The file is
   * **not** read in-process; resolution happens inside the Copilot runtime.
   *
   * @example
   * input: { config: p.readOptional(".eslintrc.json") }
   * input: { config: p.readOptional(".eslintrc.json", "{}") }
   */
  readOptional(path: string, fallback?: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read the environment variable
   * `name` and substitute its value into the prompt.  If the variable is not
   * set, the `fallback` string (default `""`) is used instead.  The variable is
   * **not** read in-process; resolution happens inside the Copilot runtime.
   *
   * @example
   * input: { token: p.env("GITHUB_TOKEN") }
   * input: { token: p.env("GITHUB_TOKEN", "unset") }
   */
  env(name: string, fallback?: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to write `contents` to `path`.
   * The write is **not** performed in-process; it is resolved by the Copilot
   * runtime when the prompt is processed.
   *
   * **This helper does not return the file path or contents as a string.**
   * When used in a template expression (e.g. `${p.write(...)}`) it contributes
   * a write-file instruction to the prompt — it does not expand to the path.
   * If the output schema needs to reference the written path, hard-code the
   * path string in the agent's output instead of reading it from this call.
   *
   * @example
   * // Writes the file; agent must hard-code "README.md" in output, not read it from here:
   * instructions: p`Write a summary: ${p.write("README.md", draft)}`
   * output: s.object({ writtenTo: s.string })  // agent infers "README.md"
   */
  write(path: string, contents: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to write the value of output field
   * `field` to the file at `path` after generating the response.  The write is
   * **not** performed in-process; it is resolved by the Copilot runtime after the
   * agent produces its structured output.
   *
   * Use this instead of `p.write` when the content to be written is the
   * LLM-generated value of an output field — it wires the output field directly
   * to the target file path so the harness can perform the write automatically.
   *
   * @example
   * // Writes the "report" output field to "todo-report.md" after generation:
   * instructions: p`Scan for TODO comments. ${p.writeOutput("report", "todo-report.md")}`
   * output: s.object({ report: s.string })
   */
  writeOutput(field: string, path: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to list files matching `pattern`
   * and substitute the results into the prompt.  Resolution happens inside the
   * Copilot runtime; no in-process glob expansion occurs.
   *
   * @example
   * input: { files: p.glob("src/**\/*.ts") }
   */
  glob(pattern: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read all files in `paths` and
   * concatenate their contents into a single prompt block.  Resolution happens
   * inside the Copilot runtime; no in-process file reading occurs.
   *
   * Use this instead of `p.bash("cat file1 file2 ...")` or repeated `p.read`
   * calls when you want to include the full contents of a known set of files
   * as a single context block.
   *
   * @example
   * input: { sources: p.readAll(["src/index.ts", "src/utils.ts"]) }
   * // In a template:
   * instructions: p`Review all source files: ${p.readAll(["src/a.ts", "src/b.ts"])}`
   */
  readAll(paths: string[], options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read the file at the path
   * provided by the named input field and substitute its contents into the
   * prompt.  Use this when a subagent receives a file path as an input field
   * and needs to read that file — `p.read(...)` requires a literal string, but
   * `p.readInput("field")` defers path resolution to the value of
   * `input.<field>` at runtime.
   *
   * @example
   * // Subagent that reads the file path supplied by its caller:
   * const fileAnalyzer = agent({
   *   input: s.object({ path: s.string }),
   *   instructions: p`Analyze the file: ${p.readInput("path")}`,
   *   output: s.object({ summary: s.string }),
   * });
   */
  readInput(field: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to read all files at the paths
   * provided by the named input field (an array of paths) and concatenate their
   * contents into a single prompt block.  Use this when a subagent receives an
   * array of file paths as an input field and needs to read all of them —
   * `p.readAll(...)` requires a literal array, but `p.readAllInput("field")`
   * defers path resolution to the value of `input.<field>` at runtime.
   *
   * @example
   * // Subagent that reads all file paths supplied by its caller:
   * const fileAnnotator = agent({
   *   input: s.object({ files: s.array(s.path) }),
   *   instructions: p`Annotate all files: ${p.readAllInput("files")}`,
   *   output: s.object({ annotations: s.array(s.string) }),
   * });
   */
  readAllInput(field: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to run `template` once per
   * element in the array at input field `inputArrayField`, substituting `{}`
   * with each element, and to collect all results.  Neither the template nor
   * the iteration is executed in-process; the harness expands this into a
   * natural-language instruction resolved by the Copilot runtime.
   *
   * Use this when a uniform shell command must be run for every element in a
   * caller-supplied string array — for example, probing each URL in a list.
   * Use `{}` as the element placeholder inside the template string.
   *
   * @example
   * // Run curl once per URL in input.endpoints:
   * const healthProbe = agent({
   *   input: s.object({ endpoints: s.array(s.url) }),
   *   instructions: p`Probe each endpoint: ${p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")}`,
   *   output: s.object({ results: s.array(s.object({ url: s.url, status: s.string })) }),
   * });
   */
  bashEach(template: string, inputArrayField: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Declarative intent that instructs the LLM to write the value of output
   * field `contentOutputField` to the file at the path provided by input field
   * `inputPathField` after generating the response.  Use this instead of
   * `p.writeOutput(field, path)` when the destination path is caller-supplied
   * rather than a static string known at definition time.
   *
   * @example
   * // Write the generated report to the path supplied by the caller:
   * const renderer = agent({
   *   input: s.object({ outputPath: s.path }),
   *   instructions: p`Render the changelog. ${p.writeInput("outputPath", "rendered")}`,
   *   output: s.object({ rendered: s.string }),
   * });
   */
  writeInput(inputPathField: string, contentOutputField: string, options?: PromptIntentOptions): PromptIntent;
  /**
   * Serializes `value` to a pretty-printed JSON string for inline use inside
   * prompt templates.  Equivalent to `JSON.stringify(value, null, 2)`.
   *
   * @example
   * const prompt = p`Context: ${p.json({ repo: "rig", stars: 42 })}`;
   */
  json(value: unknown): string;
  /**
   * Returns the string `"input.<field>"` for explicit, documented reference to
   * a caller-supplied input field in prompt prose.  Use this instead of the
   * opaque `${"input.fieldName"}` literal when you need to tell the model to
   * use a non-path input value — for example, to reference an array of file
   * paths or a string value in the instructions.
   *
   * For reading the **file contents** of a path held in an input field, use
   * `p.readInput(field)` instead.
   *
   * @example
   * // Reference a caller-supplied array of config files in the prompt:
   * instructions: p`Merge the JSON config files listed in ${p.inputField("files")}.`
   */
  inputField(field: string): string;
  /**
   * Creates a named prompt variable binding.  The variable's value is
   * rendered into the prompt at the interpolation site, and the `name` is
   * stored in `PromptBuilder.vars` for later retrieval with `.get(name)`.
   *
   * Useful when you want to pass a computed value into a template and also
   * access it by name from an addon or post-processing step.
   *
   * @example
   * const builder = p`Summarize: ${p.var("content", p.read("README.md"))}`;
   * // builder.get("content") returns the PromptIntent for README.md
   */
  var<T>(name: string, value: T): PromptVariable<T>;
  /**
   * Wraps `body` in a fenced Markdown code block for `language`.  If `body`
   * is a `PromptIntent` or `PromptBuilder`, it is rendered to text first.
   *
   * Use this to present source code, shell output, or structured data to the
   * model in a clearly delimited block that highlights the language.
   *
   * @example
   * instructions: p`Review this TypeScript: ${p.region("typescript", p.read("src/index.ts"))}`
   * // expands to:
   * // Review this TypeScript:
   * // ```typescript
   * // <file contents>
   * // ```
   */
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
    bashRaw(strings: TemplateStringsArray, ...values: unknown[]): PromptIntent {
      const command = String.raw(strings, ...(values as string[]));
      return createPromptIntent("prompt.text", { command });
    },
    read(path: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.read", withOptions({ path }, options));
    },
    readOptional(path: string, fallback = "", options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.readOptional", withOptions({ path, fallback }, options));
    },
    env(name: string, fallback = "", options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.env", withOptions({ command: name, fallback }, options));
    },
    write(path: string, contents: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.write", withOptions({ path, contents }, options));
    },
    writeOutput(field: string, path: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.writeOutput", withOptions({ field, path }, options));
    },
    glob(pattern: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.glob", withOptions({ pattern }, options));
    },
    readAll(paths: string[], options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.readAll", withOptions({ paths }, options));
    },
    readInput(field: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.readInput", withOptions({ field }, options));
    },
    readAllInput(field: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.readAllInput", withOptions({ field }, options));
    },
    bashEach(template: string, inputArrayField: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.bashEach", withOptions({ command: template, field: inputArrayField }, options));
    },
    writeInput(inputPathField: string, contentOutputField: string, options?: PromptIntentOptions): PromptIntent {
      return createPromptIntent("prompt.writeInput", withOptions({ pathField: inputPathField, field: contentOutputField }, options));
    },
    json(value: unknown): string {
      return json(value);
    },
    inputField(field: string): string {
      return `input.${field}`;
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

  bashRaw(strings: TemplateStringsArray, ...values: unknown[]): PromptIntent {
    return p.bashRaw(strings, ...values);
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

/**
 * Error thrown when an agent's response cannot be parsed as JSON or does not
 * match the declared output schema.  Surfaces in repair addons via
 * `context.error` and is re-thrown when all turns are exhausted.
 *
 * @property kind      - `"parse"` for JSON parse failures; `"validation"` for
 *                       schema mismatch.
 * @property agent     - Name of the agent that produced the invalid response.
 * @property turn      - 1-based turn number at which the failure occurred.
 * @property response  - Raw response string returned by the model.
 * @property schema    - The expected output schema at the time of failure.
 * @property schemaText - Human-readable rendering of `schema` (JSON string).
 *
 * @example
 * // Inspect the error kind inside a custom repair addon:
 * const repairAddon: AgentAddon = async (ctx, next) => {
 *   await next();
 *   if (ctx.error instanceof AgentError && ctx.error.kind === "validation") {
 *     ctx.nextPrompt = defaultRepairPrompt(ctx.spec, ctx.error);
 *   }
 * };
 */
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

const DEFAULT_STEERING_WARNING = "You are running out of turns. This is your final attempt before reaching the turn limit. Please correct your output now.";

export function steering(options: SteeringOptions = {}): AgentAddon {
  const message = options.message ?? DEFAULT_STEERING_WARNING;
  return async (context, next) => {
    await next();
    if (context.nextPrompt && context.turn + 1 === context.maxTurns) {
      context.nextPrompt = `${context.nextPrompt}\n${message}`;
    }
  };
}

export function repair(): AgentAddon {
  return async (context, next) => {
    await next();
    if (context.completed || context.error !== undefined || context.nextPrompt !== undefined) {
      return;
    }
    if (context.response === undefined) {
      return;
    }
    const analysis = analyzeResponse(context.response, context.outputSchema, context.spec.name, context.turn);
    if (analysis.ok) {
      context.completed = true;
      context.output = analysis.output;
      return;
    }
    if (context.turn >= context.maxTurns) {
      context.error = analysis.error;
      return;
    }
    context.nextPrompt = defaultRepairPrompt(context.spec, analysis.error);
  };
}

export function timeout(options: TimeoutOptions): AgentAddon {
  return async (context, next) => {
    context.signal = timeoutSignal(context.signal, options.timeout);
    await next();
  };
}

export function oncePerAgent(register: AgentRegistration): AgentAddon {
  const seen = new WeakSet<Agent>();
  return async (context, next) => {
    if (!seen.has(context.agent)) {
      await register(context.agent, context);
      seen.add(context.agent);
    }
    await next();
  };
}

export const addons = {
  oncePerAgent,
  timeout,
  repair,
  steering,
};

let currentAgentFactory: AgentFactory = defaultAgentFactory();

/**
 * Mounts an engine and executes a rig program file.
 * Relative paths are resolved from `options.cwd` (or process cwd).
 */
export async function launchRigProgram(programPath: string, options: LaunchOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = isAbsolute(programPath) ? programPath : resolve(cwd, programPath);

  configureAgent(defaultAgentFactory({ cwd, ...(options.startServer ? { startServer: true } : {}) }));
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
  const names: string[] = [];
  if (/\bagent\s*\(/u.test(programCode)) {
    names.push("agent");
  }
  if (/\bp(?:\s*`|\s*\.)/u.test(programCode)) {
    names.push("p");
  }
  if (/\bs\s*\./u.test(programCode)) {
    names.push("s");
  }
  if (names.length === 0) {
    return `import "rig";\n\n${programCode}`;
  }
  return `import { ${names.join(", ")} } from "rig";\n\n${programCode}`;
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

async function hasEsmPackageContext(filePath: string): Promise<boolean> {
  let dir = dirname(filePath);
  while (true) {
    const pkgPath = resolve(dir, "package.json");
    try {
      const content = await readFile(pkgPath, "utf8");
      const pkg = JSON.parse(content) as { type?: string };
      return pkg.type === "module";
    } catch {
      // Not found or not parseable; try parent directory.
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

async function typecheckProgram(programPath: string, cwd: string, displayPath = programPath): Promise<void> {
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
    // For .ts files outside an ESM package context, use a shadow .mts file so
    // TypeScript treats the program as ESM without requiring a package.json change.
    const inEsmContext = await hasEsmPackageContext(programPath);
    let checkPath = programPath;
    let shadowPath: string | undefined;
    if (!inEsmContext && programPath.endsWith(".ts")) {
      shadowPath = resolve(tempDir, "program.mts");
      const content = await readFile(programPath, "utf8");
      await writeFile(shadowPath, content, "utf8");
      checkPath = shadowPath;
    }
    await writeFile(projectPath, JSON.stringify({
      extends: baseTsconfigPath,
      include: [checkPath],
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
    const rawDiagnostics = [execError.stdout, execError.stderr]
      .filter((entry) => typeof entry === "string" && entry.trim())
      .join("\n")
      .trim();
    // Replace both the absolute and cwd-relative shadow .mts path with the
    // original file path so error messages reference the user's file instead
    // of the internal temp directory.
    const absoluteShadowPath = resolve(tempDir, "program.mts");
    const relativeShadowPath = `.tmp/${basename(tempDir)}/program.mts`;
    const diagnostics = rawDiagnostics
      .replaceAll(absoluteShadowPath, displayPath)
      .replaceAll(relativeShadowPath, displayPath);
    const detail = diagnostics ? `\n${diagnostics}` : "";
    const hasCjsEsmMismatch = diagnostics.includes("TS1295") || diagnostics.includes("TS1479");
    const hint = hasCjsEsmMismatch
      ? "\nHint: add {\"type\":\"module\"} to a package.json in the same directory as your rig program."
      : "";
    throw new Error(`Typecheck failed for ${displayPath}.${detail}${hint}`);
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
  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = isAbsolute(programPath) ? programPath : resolve(cwd, programPath);
  if (options.typecheck) {
    await typecheckProgram(resolvedPath, cwd);
    io.stdout.write("typecheck passed\n");
    return;
  }

  const prompt = await readStdin(io.stdin);
  if (!prompt.trim()) {
    throw new Error(`Usage: ${scriptName} <program-file>`);
  }

  configureAgent(defaultAgentFactory({ cwd, ...(options.startServer ? { startServer: true } : {}) }));
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
      await typecheckProgram(tempProgramPath, cwd, "<stdin>");
      io.stdout.write("typecheck passed\n");
      return;
    }
    configureAgent(defaultAgentFactory({ cwd, ...(options.startServer ? { startServer: true } : {}) }));
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

/**
 * Entry-point CLI that parses `argv`, wires the default engine selection, and runs the
 * agent program.  Two modes are supported:
 *
 * - **File mode** (`runLauncherCli(["path/to/prog.ts"])`): reads the agent
 *   input from stdin and invokes the root agent exported from the program file.
 * - **Stdin mode** (`runLauncherCli([])`): reads a full rig program from stdin,
 *   compiles it in a temp directory, and runs its default export.
 *
 * Recognized flags:
 * - `--server`     — use stdio transport instead of the default URI connection.
 * - `--typecheck`  — run `tsc --noEmit` before executing the program.
 * - `--help` / `-h` / `help` / `/help` / `/?` — print usage and return.
 *
 * Structured JSONL events (prefixed `rig.*`) are written to stderr; the final
 * agent output is written to stdout as JSON.
 *
 * @example
 * // In the rig.ts shebang entrypoint:
 * await runLauncherCli();
 *
 * @example
 * // With a custom working directory for tests:
 * await runLauncherCli(["src/my-agent.ts"], { cwd: "/repo" }, { stdin: process.stdin, stdout: process.stdout });
 */
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

/**
 * Defines a typed agent from a declarative spec and returns a callable function.
 *
 * The returned function accepts an input value (plain JS or with `p.*` prompt intents)
 * and returns a Promise of the validated output. The harness renders the prompt,
 * invokes the configured engine, parses the JSON response, validates it against
 * `spec.output`, and retries up to `spec.maxTurns` times on failure.
 *
 * @example
 * const summarize = agent({
 *   model: "mini",
 *   input: s.object({ text: s.string }),
 *   output: s.object({ summary: s.string, keywords: s.array(s.string) }),
 *   instructions: "Summarize the text and extract keywords.",
 * });
 * const result = await summarize({ text: p.read("README.md") });
 */
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
    debugAgentInvoke({
      agent: normalizedSpec.name,
      input: normalizedInput,
      model: runtime.model,
      maxTurns: runtime.maxTurns,
    });
    const runtimeAgent = await currentAgentFactory({
      model: runtime.model,
      ...(runtime.systemMessage !== undefined && { systemMessage: runtime.systemMessage }),
      ...(runtime.tools !== undefined && { tools: runtime.tools }),
    });
    let failure: unknown;

    try {
      for (let turn = 1; turn <= runtime.maxTurns; turn += 1) {
        throwIfAborted(runtime.signal);
        debugAgentTurn({ agent: normalizedSpec.name, turn, prompt });
        const context: AgentAddonContext = {
          spec: normalizedSpec,
          agent: runtimeAgent,
          input: normalizedInput,
          outputSchema,
          signal: runtime.signal,
          turn,
          maxTurns: runtime.maxTurns,
          prompt,
          completed: false,
        };

        await runAgentAddons(runtime.addons, context, async () => {
          lastResponse = await runtimeAgent.ask(
            context.prompt,
            context.signal ? { signal: context.signal } : undefined,
          );
          context.response = lastResponse;
          debugAgentResponse({ agent: normalizedSpec.name, turn, response: lastResponse });
        });

        if (context.error !== undefined) {
          debugAgentError({ agent: normalizedSpec.name, turn, error: context.error });
          throw context.error;
        }
        if (context.completed) {
          debugAgentComplete({ agent: normalizedSpec.name, turn, output: context.output });
          return context.output;
        }
        if (context.nextPrompt !== undefined) {
          debugAgentRetry({ agent: normalizedSpec.name, turn, nextTurn: turn + 1 });
          prompt = context.nextPrompt;
          continue;
        }
        if (context.response !== undefined) {
          const analysis = analyzeResponse(context.response, context.outputSchema, context.spec.name, context.turn);
          if (analysis.ok) {
            debugAgentComplete({ agent: normalizedSpec.name, turn, output: analysis.output });
            return analysis.output;
          }
          debugAgentError({ agent: normalizedSpec.name, turn, error: analysis.error });
          throw analysis.error;
        }
        throw new Error(
          `Agent ${normalizedSpec.name}: addons must set context.output with context.completed=true or context.nextPrompt for turn ${turn}.`,
        );
      }
    } catch (error) {
      failure = error;
      debugAgentFailure({ agent: normalizedSpec.name, error });
      throw error;
    } finally {
      try {
        debugAgentClose({ agent: normalizedSpec.name });
        const closePromise = runtimeAgent.close();
        if (failure !== undefined) {
          // When there is already a failure, cap cleanup so a hung socket or
          // unresponsive server does not prevent the error from propagating.
          await Promise.race([closePromise, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
        } else {
          await closePromise;
        }
      } catch (cleanupError) {
        if (failure === undefined) {
          throw cleanupError;
        }
      }
    }

    throw new Error(`Agent ${normalizedSpec.name} failed after ${runtime.maxTurns} turns. Last response:\n${lastResponse}`);
  };

  const fn = (async (input: unknown, options: CallOptions = {}) => invoke(input, options)) as AgentFn<any, any>;

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

export type AgentDefinitionFactory = typeof agent;

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

function normalizeToolParameters(parameters: ToolParameters | undefined): ToolParameters | undefined {
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

  const fenced = extractFencedJson(text);
  if (fenced !== undefined) {
    try {
      return { ok: true, value: JSON.parse(fenced) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const objectText = extractBalancedJson(text);
  if (objectText === undefined) {
    return { ok: false, error: "No JSON value found." };
  }

  try {
    return { ok: true, value: JSON.parse(objectText) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractFencedJson(text: string): string | undefined {
  const fenceStart = text.indexOf("```");
  if (fenceStart === -1) {
    return undefined;
  }

  let cursor = fenceStart + 3;
  while (cursor < text.length && /\s/.test(text[cursor]!)) {
    cursor += 1;
  }

  const labelStart = cursor;
  while (cursor < text.length && /[a-z0-9_-]/i.test(text[cursor]!)) {
    cursor += 1;
  }

  const label = text.slice(labelStart, cursor);
  if (label && label.toLowerCase() !== "json") {
    return undefined;
  }

  while (cursor < text.length && /\s/.test(text[cursor]!)) {
    cursor += 1;
  }

  const fenceEnd = text.indexOf("```", cursor);
  if (fenceEnd === -1) {
    return undefined;
  }

  return text.slice(cursor, fenceEnd);
}

function extractBalancedJson(text: string): string | undefined {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const start =
    objectStart === -1 ? arrayStart :
    arrayStart === -1 ? objectStart :
    Math.min(objectStart, arrayStart);
  if (start === -1) {
    return undefined;
  }

  const openChar = text[start] as "{" | "[";
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function validateSchema(value: unknown, schema: Schema, path: string, optional: boolean): ValidationResult {
  if ((optional || isOptionalSchema(schema)) && value === undefined) {
    return { ok: true };
  }
  if (isOptionalSchema(schema) && value === null) {
    return { ok: false, error: `${path}: optional field must be omitted or a valid value, not null (use s.nullable to allow null)` };
  }
  if ("nullable" in schema && schema.nullable === true) {
    if (value === null) return ok();
    return validateSchema(value, (schema as NullableSchema).inner, path, false);
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
    const minItems = (schema as ArraySchema).minItems;
    if (minItems !== undefined && value.length < minItems) {
      return { ok: false, error: `${path}: expected array with at least ${minItems} item(s), got ${value.length}` };
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
      const fieldValue = (value as Record<string, unknown>)[key];
      const fieldPath = `${path}.${key}`;
      const isOptional = isOptionalSchema(fieldSchema);
      if (fieldValue === undefined && !isOptional) {
        const expectedType = describeSchemaType(fieldSchema);
        return { ok: false, error: `${fieldPath}: missing required field (expected ${expectedType})` };
      }
      const result = validateSchema(fieldValue, fieldSchema, fieldPath, false);
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
    const minProperties = (schema as RecordSchema).minProperties;
    const keyCount = Object.keys(value as object).length;
    if (minProperties !== undefined && keyCount < minProperties) {
      const gotDesc = keyCount === 0 ? "empty object" : `object with ${keyCount} key(s)`;
      return { ok: false, error: `${path}: expected object with at least ${minProperties} key(s), got ${gotDesc}` };
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
    if (schema.type === "string") {
      if (typeof value !== "string") return bad(path, "string", value);
      const { minLength, format } = schema as StringSchema;
      if (minLength !== undefined && value.length < minLength) {
        const gotDesc = value.length === 0 ? "empty string" : `string of length ${value.length}`;
        return { ok: false, error: `${path}: expected string with minLength ${minLength}, got ${gotDesc}` };
      }
      if (format === "uri") {
        try { new URL(value); } catch { return { ok: false, error: `${path}: expected a valid URL, got ${JSON.stringify(value)}` }; }
      }
      if (format === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { ok: false, error: `${path}: expected a date string in YYYY-MM-DD format, got ${JSON.stringify(value)}` };
        }
      }
      return ok();
    }
    if (schema.type === "number") {
      if (typeof value !== "number") return bad(path, "number", value);
      const { minimum, maximum } = schema as NumberSchema;
      if (minimum !== undefined && value < minimum) return { ok: false, error: `${path}: expected number >= ${minimum}, got ${value}` };
      if (maximum !== undefined && value > maximum) return { ok: false, error: `${path}: expected number <= ${maximum}, got ${value}` };
      return ok();
    }
    if (schema.type === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) return bad(path, "integer", value);
      const { minimum, maximum } = schema as IntegerSchema;
      if (minimum !== undefined && value < minimum) return { ok: false, error: `${path}: expected integer >= ${minimum}, got ${value}` };
      if (maximum !== undefined && value > maximum) return { ok: false, error: `${path}: expected integer <= ${maximum}, got ${value}` };
      return ok();
    }
    if (schema.type === "boolean") return typeof value === "boolean" ? ok() : bad(path, "boolean", value);
    if (schema.type === "null") return value === null ? ok() : bad(path, "null", value);
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

/**
 * Parses and validates a raw agent response string against `outputSchema`.
 *
 * JSON extraction strategy (in order):
 * 1. Parse the entire `response` string directly as JSON.
 * 2. Extract and parse the first ` ```json … ``` ` fenced block.
 * 3. Extract and parse the first balanced `{…}` or `[…]` value.
 *
 * Returns `{ok:true, output}` on success, or `{ok:false, error:AgentError}` on
 * parse failure or schema validation failure.
 */
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
    case "prompt.readOptional":
      return `Read file and return its contents as text: ${JSON.stringify(requiredPath(intent))}. If the file does not exist, return ${JSON.stringify(intent.fallback ?? "")} instead${promptExecutionContext()}${options}`;
    case "prompt.env":
      return `Read environment variable ${JSON.stringify(intent.command ?? "")} and return its value as text. If the variable is not set, return ${JSON.stringify(intent.fallback ?? "")} instead${promptExecutionContext()}${options}`;
    case "prompt.write":
      return `Write file at path ${JSON.stringify(requiredPath(intent))} with contents:\n${intent.contents ?? ""}${promptExecutionContext()}${options}`;
    case "prompt.writeOutput":
      return `After generating the response, write the value of output field ${JSON.stringify(intent.field ?? "")} to the file at path ${JSON.stringify(requiredPath(intent))}${promptExecutionContext()}${options}`;
    case "prompt.glob":
      return `List files matching glob pattern ${JSON.stringify(intent.pattern ?? "")} and return the list of matching paths${promptExecutionContext()}${options}`;
    case "prompt.readAll": {
      const paths = intent.paths ?? [];
      if (paths.length === 0) {
        throw new Error("p.readAll requires at least one path.");
      }
      return `Read each of the following files and concatenate their contents in order:\n${paths.map((p) => `- ${JSON.stringify(p)}`).join("\n")}${promptExecutionContext()}${options}`;
    }
    case "prompt.readInput":
      return `Read the file at the path provided by input field ${JSON.stringify(intent.field ?? "")} and return its contents as text${promptExecutionContext()}${options}`;
    case "prompt.readAllInput":
      return `Read all files at the paths provided by input field ${JSON.stringify(intent.field ?? "")} and concatenate their contents in order${promptExecutionContext()}${options}`;
    case "prompt.bashEach":
      return `For each element in the array at input field ${JSON.stringify(intent.field ?? "")}, run the command ${JSON.stringify(intent.command ?? "")} with {} replaced by the element, and collect all results${promptExecutionContext()}${options}`;
    case "prompt.writeInput":
      return `After generating the response, write the value of output field ${JSON.stringify(intent.field ?? "")} to the file at the path provided by input field ${JSON.stringify(intent.pathField ?? "")}${promptExecutionContext()}${options}`;
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

/**
 * Replaces the global `AgentFactory` used by all subsequent `agent()` calls.
 *
 * Call this once at program startup (before invoking any agent) to swap in a
 * custom or mocked engine.  The harness itself calls it internally via
 * `launchRigProgram` / `runLauncherCli`; most application code does not need
 * to call it directly.
 *
 * @example
 * // Use a custom engine for all agents in this module:
 * configureAgent(copilotEngine({ server: true }));
 *
 * @example
 * // Inject a stub engine in tests:
 * configureAgent(() => ({ ask: async () => '{"ok":true}', close: async () => {} }));
 */
export function configureAgent(factory: AgentFactory): void {
  currentAgentFactory = factory;
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

function responseText(response: unknown): string {
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
  systemMessage: unknown;
  tools: Tool<any>[] | undefined;
} {
  return {
    model: options.model ?? spec.model ?? "small",
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
  for (let i = 0; i < items.length; i++) {
    const addon = items[i];
    if (typeof addon !== "function") {
      const got = addon === null ? "null" : typeof addon;
      throw new Error(`Agent addon entries must be functions (entry at index ${i} is ${got}).`);
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
  if ("nullable" in schema && schema.nullable === true) {
    assertValidSchema((schema as NullableSchema).inner, agentName, slot, path);
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

function longestSharedPrefixLength(value: string, candidates: readonly string[]): number {
  let bestPrefixLength = 0;
  for (const candidate of candidates) {
    let prefixLength = 0;
    while (
      prefixLength < candidate.length
      && prefixLength < value.length
      && candidate[prefixLength] === value[prefixLength]
    ) {
      prefixLength += 1;
    }
    if (prefixLength > bestPrefixLength) {
      bestPrefixLength = prefixLength;
    }
  }
  return bestPrefixLength;
}

function previewWithFirstDiff(value: string | undefined, expected: string, maxPreview: number): string | undefined {
  if (value === undefined) return undefined;
  const expectedLiterals = expected.split(" | ");
  let previewStart = 0;
  if (value.length > maxPreview) {
    const bestPrefixLength = longestSharedPrefixLength(value, expectedLiterals);
    previewStart = bestPrefixLength > 0 ? Math.max(0, bestPrefixLength - 20) : 0;
    if (previewStart + maxPreview > value.length) {
      previewStart = value.length - maxPreview;
    }
  }
  const preview = value.slice(previewStart, previewStart + maxPreview);
  const prefixEllipsis = previewStart > 0 ? "…" : "";
  const suffixEllipsis = previewStart + maxPreview < value.length ? "…" : "";
  return `${prefixEllipsis}${preview}${suffixEllipsis}`;
}

function describeSchemaType(schema: Schema): string {
  if ("nullable" in schema && schema.nullable === true) {
    return `${describeSchemaType((schema as NullableSchema).inner)} | null`;
  }
  if ("items" in schema) {
    const itemType = describeSchemaType((schema as ArraySchema).items);
    return `array of ${itemType}`;
  }
  if ("type" in schema) {
    return (schema as { type: string }).type;
  }
  if ("enum" in schema) {
    return (schema as EnumSchema).enum.map((v: Json) => JSON.stringify(v)).join(" | ");
  }
  if ("properties" in schema || "additionalProperties" in schema) {
    return "object";
  }
  return "any";
}

function bad(path: string, expected: string, actual: unknown): ValidationResult {
  const actualType = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
  const actualRepr = JSON.stringify(actual);
  const truncated = previewWithFirstDiff(actualRepr, expected, 80);
  const detail = truncated !== undefined ? ` (${truncated})` : "";
  return { ok: false, error: `${path}: expected ${expected}, got ${actualType}${detail}` };
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
    process.exit(1);
  });
}
