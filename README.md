# rig

`rig` is a minimal TypeScript agent harness skill designed to run inside sandboxed agentic workflows embedded in markdown.

## Install

```bash
npm install github:githubnext/rig#v0.0.8
```

Or install the skill for Copilot coding agent:

```bash
gh skills clone githubnext/rig
```

## Core API

```ts
import {
  agent,
  addons,
  configureAgent,
  defineTool,
  oncePerAgent,
  p,
  repair,
  s,
  steering,
  timeout,
} from "rig";
```

- `agent(spec)` creates a typed agent function.
- `s.*` defines input/output schemas. Omit `input`/`output` when free-form strings are enough.
- `p.*` creates declarative prompt intents for prompt templates or inputs.
- `p()` and ``p`...` `` create a prompt builder with `var`, `write`, and `region` primitives for assembling prompts.
- ``p`...` `` also works in `instructions` to embed prompt intents directly: `` instructions: p`Review ${p.bash("git status")}` ``.
- `configureAgent(factory)` selects the SDK adapter used to instantiate runtime agents.
- `defineTool(name, config)` creates an SDK-neutral tool definition and accepts rig `s.*` schemas for `parameters`.
- `addons` accepts express-like `(context, next)` turn addons for steering, inline validation, and runtime agent access.
- `rig` starts with no default addons.
- `rig` exports addon helpers: `oncePerAgent`, `repair`, `steering`, `timeout`.
- `p\`...\`` returns a prompt builder and renders intent values when coerced to string; prefer `${p.read(...)}` / `${p.bash(...)}` when the context source is already known.

## Embedding in markdown

Use `rig` code fences in markdown files to define runnable harness programs:

````markdown
```rig
export default "Summarize this repository.";
```
````

Extract the `rig` fence and run it with:

```bash
awk '/^```rig$/{in_block=1;next}/^```$/{if(in_block){exit}}in_block' ./program.md | node skills/rig/rig.ts
```

## Quick start

```ts
import { agent, p, s } from "rig";

// Agent role: extract package scripts and summarize what they do.
const extractScripts = agent({
  model: "nano",
  instructions: p`Read ${p.read("package.json")} and summarize the package scripts. Use ${p.bash("find src -name '*.ts' -type f | sort")} only to call out source files that look relevant.`,
  output: s.object({
    scriptsByName: s.record(s.string),
    summary: s.string,
    relatedFiles: s.array(s.string),
  }),
});

export default extractScripts;
```

When the context already lives in the workspace, prefer intent templates like the example above over adding `input` fields just to shuttle shell output or file contents. Favor `p.read("path")` over `p.bash("cat path")`, and let the harness work from files instead of assembling large in-memory strings first.

## Schemas

```ts
s.string
s.string("description")
s.nonEmptyString                    // string with minLength: 1
s.nonEmptyString("description")
s.url                               // string with format: "uri"
s.url("description")
s.path                              // string with format: "path"; use for file system paths
s.path("description")
s.number
s.integer
s.int                               // alias for s.integer; prefer for counts, line numbers, integer-only fields
s.boolean
s.unknown
s.array(item, "description")
s.nonEmptyArray(item)               // array with minItems: 1
s.nonEmptyArray(item, "description")
s.object(fields, "description")
s.record(value, "description")
s.nonEmptyObject(value)             // Record<string, V> with minProperties: 1
s.nonEmptyObject(value, "description")
s.enum(...values)
s.enum(values, "description")
s.optional(shape)
s.optional(shape, "description")
s.nullable(shape)
s.nullable(shape, "description")
s.literal(value)
s.literal(value, "description")
```

Use declarative `s.*` helpers for every schema node.
`s.*` values serialize directly as JSON Schema, so no separate conversion step is needed.
Rig renders these declarations as JSON Schema in prompt schema blocks.
Implicit object literals, trailing-underscore optional fields, and `{"*": ...}` record sugar are not supported.

## Prompt intents

Prompt intents for shell and file operations are optimized for sandboxed agentic workflows. They assume the harness is already running with the required constraints and protections, so the generated instructions tell the agent to execute the action directly instead of adding extra permission prompts.

```ts
p.bash("git status --short")
p.bash("npm test")
p.bashRaw`grep -rn 'app\.get\|app\.post' src/`  // tagged template: no TypeScript escape needed
p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")  // run once per element in input.endpoints
p.read("README.md")
p.readOptional("Dockerfile")           // returns "" if file is absent
p.readOptional(".eslintrc.json", "{}") // returns "{}" if file is absent
p.readAll(["src/index.ts", "src/utils.ts"])  // reads all files and concatenates their contents
p.readInput("path")                    // reads the file at the single path held in input.path
p.readAllInput("files")               // reads all files at the paths in input.files (array field)
p.write("README.md", "# Updated\n")   // write-file instruction; does NOT return the path
p.writeOutput("report", "todo-report.md")  // after generation, write output field "report" to file
p.writeInput("outputPath", "rendered")     // after generation, write output field "rendered" to the path in input.outputPath
p.glob("src/**/*.ts")
p.env("GITHUB_TOKEN")                  // returns "" if variable is not set
p.env("GITHUB_TOKEN", "unset")         // returns "unset" if variable is not set
p.json({ repo: "rig", stars: 42 })
p.inputField("files")                  // returns "input.files" for use in prompt prose

const reviewWorkspace = agent({
  instructions: p`Review ${p.read("README.md")} against ${p.bash("git status --short")}.`,
});
```

`p.bash(cmd)` requires backslashes to be escaped as in any TypeScript string literal. When a command contains regex patterns (e.g. `grep 'foo\|bar'`), use `p.bashRaw\`...\`` instead — it takes the command verbatim with no TypeScript escaping.

`p.bashEach(template, inputArrayField)` runs the template once per element in a caller-supplied string array, substituting `{}` with each element.  Use it instead of prose-based iteration when the same command applies to every element.

`p.write(path, contents)` contributes a write-file instruction to the prompt; it does **not** return the file path or contents as a string. When used in a template expression the result is a prompt instruction, not the path. If the output schema includes the written file path, hard-code the path string in the agent's output.

`p.writeOutput(field, path)` instructs the harness to write the value of output field `field` to the **static** file path `path` after the agent generates its response. Use this instead of `p.write` when the content to be written is LLM-generated.

`p.writeInput(inputPathField, contentOutputField)` is like `p.writeOutput` but accepts a **dynamic destination path** from an input field.  Use it when the caller supplies the path to write to — e.g. `p.writeInput("outputPath", "rendered")` writes the `rendered` output field to the path held in `input.outputPath`.

`p.readAll(paths)` reads all files in the array and concatenates their contents into a single block. Use it instead of repeated `p.read(...)` calls or `p.bash("cat ...")` when you need the full contents of a known set of files as one context block.

`p.readInput(field)` reads the file at the **single** path held in the named input field.  `p.readAllInput(field)` reads all files at the paths in an input array field and concatenates their contents — use it when the input field is `s.array(s.path)`.  Use `p.inputField(field)` when the input field is not a file path but you still need to reference its value in the prompt prose.  `p.inputField("files")` returns `"input.files"` for use in template expressions — an explicit, documented alternative to the opaque `${"input.files"}` literal.

```ts
const b = p();
const repo = b.var("repo", "rig");
b.write("Summarize repository ", repo, ".\n");
b.write("Start by checking ", b.bash("git status --short"), ".\n");
b.region("ts", "type Summary = { text: string };");
const prompt = b.toString();
```

## Tools

Register custom tools directly on an agent using the same shape as `@github/copilot-sdk`:

```ts
const lookupIssue = defineTool("lookup_issue", {
  description: "Look up an issue by id.",
  parameters: s.object({
    issue: s.string,
  }),
  handler: async ({ issue }) => `Issue ${issue}`,
});

const triage = agent({
  instructions: "Use lookup_issue before answering.",
  tools: [lookupIssue],
});
```

Rig defaults agent tools to `skipPermission: true`, and you can also place plain tool objects in `tools`; rig will convert `s.*` parameter schemas into JSON Schema before creating the Copilot session.
When `parameters` uses `s.*` schemas, `handler` args are inferred automatically; for plain JSON Schema, pass an explicit generic like `defineTool<{ issue: string }>(...)`.

The `handler` may return a `string` or any JSON-serializable value. Rig automatically serializes non-string return values to JSON before passing them back to the model — do not call `JSON.stringify` manually in the handler.
## Evaluating agentic performance

Use these samples to quickly gauge how well `rig` supports increasingly agentic workflows:

- `skills/rig/samples/20-issue-reproducer.md` — chained diagnose/fix flow
- `skills/rig/samples/36-subagent-delegation.md` — delegation between focused agents
- `skills/rig/samples/47-prompt-intents.md` — prompt intents embedded directly in prompt templates
- `skills/rig/samples/50-end-to-end-release-agent.md` — multi-step release planning workflow
- `docs/rig-syntax-genaiscript-comparison.md` — comparison of rig syntax with 10 GitHub GenAIScript sample ports

## Agent behavior

- Default model: `small`
- Default max turns: `4`
- No addons are loaded by default (including repair/retry behavior)

Per call, you can override `model`, `timeout`, `maxTurns`, and `signal`.

## Debug logging

Set `RIG_DEBUG` to emit lazy JSONL diagnostics to stderr. A category enables itself and its children, `*` enables everything, and a `-` prefix excludes a category:

```bash
RIG_DEBUG=agent node skills/rig/rig.ts program.ts
RIG_DEBUG='engine:copilot:*,-engine:copilot:event' node skills/rig/rig.ts program.ts
```

Rig uses `agent:*` categories for invocation, turns, responses, retries, completion, failures, and cleanup. Copilot adapter events use `engine:copilot:*`; default adapter selection uses `engine:select`.

Custom integrations can use the same logger. Details are evaluated only when the category is enabled, and logger failures never affect execution:

```ts
import { debug } from "rig";

const log = debug("my-addon:result");
log({ status: "started" });
log(() => ({ result: expensiveResult() }));
if (log.enabled) {
  // Optional setup for debug-only instrumentation.
}
```

## Addons

Each agent call runs a per-turn addon chain:

```ts
const steerFinalTurn = async (context, next) => {
  await next();
  if (context.nextPrompt && context.turn === context.maxTurns - 1) {
    context.nextPrompt = `${context.nextPrompt}\nYou are running out of turns. Return corrected JSON now.`;
  }
};

const review = agent({
  maxTurns: 3,
  addons: steerFinalTurn,
});
```

`context` includes `prompt`, `response`, `turn`, `maxTurns`, `signal`, `output`, `nextPrompt`, `error`, and `completed`.

For the common retry flow with last-turn steering or stable default timeouts, opt into addons:

```ts
const review = agent({
  maxTurns: 3,
  addons: [timeout({ timeout: 30_000 }), steering(), repair()],
});
```

Use `oncePerAgent(...)` to register with the runtime agent once:

```ts
const review = agent({
  addons: oncePerAgent((runtimeAgent) => {
    // Register adapter-specific behavior here.
  }),
});
```

Per-turn addons receive `context.agent`, and you can also register addons after creating the agent:

```ts
const timingAddon = async (context, next) => {
  await next();
};

const review = agent({});
review.use(timingAddon);
```

`agent.use()` accepts **only** `AgentAddon | AgentAddon[]`. It does not accept spec fields or call-time overrides — passing `maxTurns`, `model`, or similar is a type error. Put stable defaults in the agent spec; pass per-run overrides at call time.

## Agent implementations

Rig runs only against a minimal interface:

```ts
interface Agent {
  ask(prompt: string, options?: { signal?: AbortSignal }): Promise<string>;
  close(): Promise<void>;
}
```

Configure any SDK adapter by passing a factory that creates one `Agent` per invocation:

```ts
configureAgent(async ({ model, systemMessage, tools }) => {
  return new MySdkAgent({ model, systemMessage, tools });
});
```

Rig includes factories for Copilot, Codex, Gemini CLI, pi-agent, and Anthropic:

```ts
import { configureAgent } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";
import { codexEngine } from "rig/engines/codex";
import { geminiEngine } from "rig/engines/gemini";
import { piEngine } from "rig/engines/pi";

configureAgent(piEngine({ provider: "anthropic" }));
// or, using ANTHROPIC_API_KEY:
configureAgent(anthropicEngine());
// or, using Codex authentication:
configureAgent(codexEngine());
// or, using an installed and authenticated Gemini CLI:
configureAgent(geminiEngine());
```

If you do not call `configureAgent(...)`, Rig now auto-selects a default engine from environment variables: `COPILOT_SDK_URI` → `copilotEngine()`, then `RIG_ENGINE` (`copilot` | `anthropic` | `codex` | `gemini`) if set, then `ANTHROPIC_API_KEY` → `anthropicEngine()`, `OPENAI_API_KEY` → `codexEngine()`, `GEMINI_API_KEY`/`GOOGLE_API_KEY` → `geminiEngine()`, otherwise `copilotEngine()`.

`piEngine()` uses the maintained `@earendil-works/pi-agent-core` package and requires the provider for model lookup. `anthropicEngine()` uses `@anthropic-ai/sdk`. Both adapters preserve conversation state across repair turns and map Rig tools to their SDK tool runners.

`codexEngine()` uses `@openai/codex-sdk`, preserves its thread across repair turns, and accepts Codex client options plus thread options under `thread`. Rig system messages become Codex developer instructions. The Codex SDK does not expose custom tool registration, so the adapter rejects agents with Rig tools.

`geminiEngine()` runs the installed `gemini` executable in headless JSON mode and resumes its session across repair turns. It accepts `command`, `cwd`, additional CLI `args`, environment variables, and an optional `approvalMode`. Rig system messages are prepended to the first prompt. The Gemini CLI does not expose custom tool registration through its command line, so the adapter rejects agents with Rig tools.

## Copilot SDK adapter

When Copilot is selected, it connects to an already-running Copilot server via HTTP (`COPILOT_SDK_URI`, then `localhost:7777`).
Pass `--server` to spawn the server over stdio when launching a program.
Run `node skills/rig/rig.ts --help` for CLI usage; the launcher also accepts common help aliases such as `-h`, `help`, `/help`, and `/?`.

For runnable programs, you can pipe a rig program directly on stdin (assumes the Copilot server is already running):

```bash
cat <<'RIG' | node skills/rig/rig.ts
import { p } from "rig";
export default p`Summarize this repository and include highlights from ${p.read("README.md")}.`;
RIG
```

Inline stdin programs run a default-exported root program with no required external input and write the result to stdout. Export either an agent, a string, or a prompt builder. If `export default` is omitted, the harness defaults to the first `const/let/var name = agent(...)` assignment.  
`import { agent, p, s } from "rig"` is optional in inline mode because the harness injects it when missing.

Inline mode accepts root agents that either omit `input`, use `input: s.object({})`, or rely on the default `input: s.string` (which is invoked with `""`).

Pass `--server` to start the Copilot server automatically as part of the run:

```bash
cat ./program.ts | node skills/rig/rig.ts --server
```

Pass `--typecheck` to typecheck the rig program and exit without executing it.
On success, prints `typecheck passed` to stdout and exits 0. On failure, throws with the TypeScript diagnostics.

```bash
cat ./program.ts | node skills/rig/rig.ts --typecheck
```

To run a root program from a program file, export the root value as the default export and pass input on stdin:

```bash
echo "Summarize this repository" | node skills/rig/rig.ts src/program.ts
```

Program-file mode also supports `--typecheck`:

```bash
echo "Summarize this repository" | node skills/rig/rig.ts src/program.ts --typecheck
```

For program-file mode stdin coercion:
- if root input schema is `string`, stdin is passed as raw text
- if root input schema is an object containing `text`, stdin is passed as `{ text: "<stdin>" }`
- otherwise stdin must be valid JSON for the declared input schema

Copilot SDK lifecycle events and rig request events are logged to stderr as JSONL.

## Local development

```bash
npm test
npm run typecheck
```
