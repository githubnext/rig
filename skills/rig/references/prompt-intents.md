# Prompt intents

Read this reference when instructions need shell, file, glob, environment, JSON, or post-generation write behavior.

## Mental model

`p` is both the ``p`...` `` prompt template tag and the prompt-intent namespace. Intent helpers contribute instructions/context to the assembled prompt; they do not perform shell or file operations while the TypeScript expression is being built.

Rig assumes the surrounding workflow supplies its sandbox and protections, so shell/file intents instruct the model to act directly without extra permission prompts.

Prefer intent expressions when a context source is known:

```ts
import { agent, p, s } from "rig";

// Agent role: review repository state using workspace context.
const review = agent({
  model: "mini",
  instructions: p`Review ${p.read("README.md")} against ${p.bash("git status --short")}.`,
  output: s.object({ summary: s.string }),
});

export default review;
```

Multiple intents in one template resolve independently in order. Nested prompt builders are inlined as text, and the rendered prompt builder replaces the instructions string during prompt assembly.
Intent values are also accepted in agent inputs, but prefer template expressions whenever the source is already known.

## Helper selection

| Helper | Use |
|--------|-----|
| `p.bash(command)` | Shell command written as a normal TypeScript string |
| ``p.bashRaw`command` `` | Verbatim shell command with no TypeScript backslash escaping |
| `p.read(path)` | Required file at a literal path |
| `p.readOptional(path, fallback?)` | Literal path that may be absent; default fallback is `""` |
| `p.readAll(paths)` | Concatenated contents of several known files |
| `p.readInput(field)` | File path taken from `input.<field>` at runtime |
| `p.write(path, content)` | Prompt instruction to write content already known |
| `p.writeOutput(field, path)` | Post-generation write of an output field |
| `p.glob(pattern)` | Runtime workspace path discovery |
| `p.env(name, fallback?)` | Environment variable; default fallback is `""` |
| `p.json(value)` | Immediate pretty-printed JSON for inline structured context |

Examples:

```ts
p.bash("git diff -- .")
p.bash("npm test")
p.bashRaw`grep -rn 'app\.get\|app\.post' src/`
p.read("README.md")
p.readOptional("Dockerfile")
p.readOptional(".eslintrc.json", "{}")
p.readAll(["src/index.ts", "src/utils.ts"])
p.readInput("path")
p.write("README.md", "# Hello\n")
p.writeOutput("report", "todo-report.md")
p.glob("src/**/*.ts")
p.env("GITHUB_TOKEN")
p.env("GITHUB_TOKEN", "unset")
p.json({ repo: "rig", stars: 42 })
```

Use ``p.bashRaw`...` `` when regex or shell syntax contains sequences such as `\.`, `\|`, or other backslashes. A normal `p.bash("...")` argument follows TypeScript string escaping rules.

Glob brace expansion and negation are runtime-dependent; use simple wildcard patterns when portability matters.

## Inputs versus context

Only introduce an input field for caller-supplied data. Known workspace files and commands belong directly in the instructions:

```ts
instructions: p`Summarize ${p.read("package.json")} and verify it with ${p.bash("npm test")}.`
```

Do not:

- add input fields merely to carry known file contents or command output
- shell out through `cat` when `p.read` or `p.readAll` expresses the intent
- construct large in-memory strings when the context already lives in files

## `p.write` versus `p.writeOutput`

| Situation | Use |
|-----------|-----|
| Content is known while building the prompt | `p.write(path, content)` |
| Content is generated into an output field | `p.writeOutput(field, path)` |
| TypeScript needs the written path as a value | Use the literal path; neither helper returns it |

`p.write` is an instruction embedded in the prompt. It does not return the path, contents, or subsequently written file. Use a separate `p.read(path)` expression if later prompt context must read that file.

`p.writeOutput` runs after valid structured output is produced. Its field must exist in the output schema:

```ts
import { agent, p, s } from "rig";

// Agent role: generate and persist a concise report.
const report = agent({
  model: "mini",
  instructions: p`Inspect ${p.bash("git status --short")}. ${p.writeOutput("report", "todo-report.md")}`,
  output: s.object({ report: s.string }),
});

export default report;
```

Do not rely on `p.writeOutput` to create an output field.

## Dynamic path reads

`p.read(path)` requires a literal path known at definition time. When a subagent receives the path in its input, defer the read with `p.readInput(field)`:

```ts
import { agent, p, s } from "rig";

// Agent role: analyze one caller-selected file.
const fileAnalyzer = agent({
  model: "mini",
  input: s.object({ path: s.path }),
  instructions: p`Analyze ${p.readInput("path")}.`,
  output: s.object({
    summary: s.string,
    lineCount: s.int,
  }),
});

export default fileAnalyzer;
```

The argument is the input field name, not the path itself. Passing full contents remains reasonable for small payloads; pass a path for larger files to reduce prompt size.

## Failures

Shell and dynamic-read intents are instructions to the runtime/model. If a command exits non-zero or a dynamic file cannot be read, the resulting stderr or error message enters prompt context so the model can surface or recover from it.

Use `p.readOptional` for a literal path that may be absent. For a dynamic path, tell the agent how to handle a missing file.
