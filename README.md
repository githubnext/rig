# rig

`rig` is a minimal TypeScript agent harness skill designed to run inside sandboxed agentic workflows embedded in markdown.

## Install

```bash
npm install github:pelikhan/rig#v0.0.8
```

Or install the skill for Copilot coding agent:

```bash
gh skills clone pelikhan/rig
```

## Core API

```ts
import {
  agent,
  defineTool,
  p,
  s,
} from "rig";
import { addons, oncePerSession, repair, steering, timeout } from "rig/addons";
```

- `agent(spec)` creates a typed agent function.
- `s.*` defines input/output schemas. Omit `input`/`output` when free-form strings are enough.
- `p.*` creates declarative prompt intents for prompt templates or inputs.
- `p()` and ``p`...` `` create a prompt builder with `var`, `write`, and `region` primitives for assembling prompts.
- ``p`...` `` also works in `instructions` to embed prompt intents directly: `` instructions: p`Review ${p.bash("git status")}` ``.
- `defineTool(name, config)` matches the Copilot SDK helper and accepts rig `s.*` schemas for `parameters`.
- `addons` accepts express-like `(context, next)` turn addons for steering, inline validation, and Copilot session access.
- `rig` starts with no default addons.
- `rig/addons` provides optional addon helpers: `oncePerSession`, `repair`, `steering`, `timeout`, and `addons.{oncePerSession,repair,steering,timeout}`.
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
s.number
s.boolean
s.unknown
s.array(item, "description")
s.object(fields, "description")
s.record(value, "description")
s.enum(...values)
s.enum(values, "description")
s.optional(shape)
s.optional(shape, "description")
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
p.read("README.md")
p.write("README.md", "# Updated\n")

const reviewWorkspace = agent({
  instructions: p`Review ${p.read("README.md")} against ${p.bash("git status --short")}.`,
});
```

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

## Evaluating agentic performance

Use these samples to quickly gauge how well `rig` supports increasingly agentic workflows:

- `skills/rig/samples/20-issue-reproducer.md` — chained diagnose/fix flow
- `skills/rig/samples/36-subagent-delegation.md` — delegation between focused agents
- `skills/rig/samples/47-prompt-intents.md` — prompt intents embedded directly in prompt templates
- `skills/rig/samples/50-end-to-end-release-agent.md` — multi-step release planning workflow
- `docs/rig-syntax-genaiscript-comparison.md` — comparison of rig syntax with 10 GitHub GenAIScript sample ports

## Agent behavior

- Default model: `gpt-4.1`
- Default max turns: `4`
- No addons are loaded by default (including repair/retry behavior)

Per call, you can override `model`, `timeout`, `maxTurns`, and `signal`.

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
  addons: [timeout({ timeout: 30_000 }), steering(), repair],
});
```

For direct SDK access, use `oncePerSession(...)` to register with the session once:

```ts
const review = agent({
  addons: oncePerSession((session) => {
    session.on?.((event) => {
      // custom event handling
    });
  }),
});
```

Per-turn addons still receive `context.session` directly, and you can also register addons after creating the agent:

```ts
const timingAddon = async (context, next) => {
  await next();
};

const review = agent({});
review.use(timingAddon);
```

## Copilot SDK runtime

`rig` is specialized for Copilot SDK sessions inside sandboxed agentic workflows.

By default it connects to an already-running Copilot server via HTTP (`COPILOT_SDK_URI`, then `localhost:7777`).
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

Pass `--typecheck` to typecheck the rig program before execution:

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
