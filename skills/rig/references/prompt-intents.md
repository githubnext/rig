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
| `p.bashEach(template, inputArrayField)` | Run `template` once per element in `input.<field>`, substituting `{}` with each element |
| `p.read(path)` | Required file at a literal path |
| `p.readOptional(path, fallback?)` | Literal path that may be absent; default fallback is `""` and is injected as prompt text |
| `p.readAll(paths)` | Concatenated contents of several known files (path list only; no glob overload) |
| `p.readInput(field)` | File contents at the **single** path held in `input.<field>` at runtime |
| `p.readAllInput(field)` | Concatenated contents of all files at the paths in `input.<field>` (array) at runtime |
| `p.write(path, content)` | Prompt instruction to write content already known |
| `p.writeOutput(field, path)` | Post-generation write of an output field to a **static** path |
| `p.writeInput(inputPathField, contentOutputField)` | Post-generation write of an output field to a **dynamic** path from an input field |
| `p.glob(pattern)` | Runtime workspace path discovery |
| `p.env(name, fallback?)` | Environment variable; default fallback is `""` |
| `p.json(value)` | Immediate pretty-printed JSON for inline structured context |
| `p.inputField(field)` | Returns `"input.<field>"` for explicit reference to a non-path input value in prose |

Examples:

```ts
p.bash("git diff -- .")
p.bash("npm test")
p.bashRaw`grep -rn 'app\.get\|app\.post' src/`
p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")
p.read("README.md")
p.readOptional("Dockerfile")
p.readOptional(".eslintrc.json", "{}")
p.readAll(["src/index.ts", "src/utils.ts"])
p.readInput("path")
p.readAllInput("files")               // reads all files at the paths in input.files (array)
p.write("README.md", "# Hello\n")
p.writeOutput("report", "todo-report.md")
p.writeInput("outputPath", "rendered")  // writes output field "rendered" to path in input.outputPath
p.glob("src/**/*.ts")
p.env("GITHUB_TOKEN")
p.env("GITHUB_TOKEN", "unset")
p.json({ repo: "rig", stars: 42 })
p.inputField("files")
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

## `p.write`, `p.writeOutput`, and `p.writeInput`

| Situation | Use |
|-----------|-----|
| Content is known while building the prompt | `p.write(path, content)` |
| Content is generated into an output field; path is static | `p.writeOutput(field, path)` |
| Content is generated into an output field; path comes from an input field | `p.writeInput(inputPathField, contentOutputField)` |
| TypeScript needs the written path as a value | Use the literal path; no helper returns it |

`p.write` is an instruction embedded in the prompt. It does not return the path, contents, or subsequently written file. Use a separate `p.read(path)` expression if later prompt context must read that file.

`p.writeOutput` runs after valid structured output is produced. Its field must exist in the output schema. The `path` argument is a **static string** fixed at definition time:

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

`p.writeInput` is like `p.writeOutput` but accepts a **dynamic destination path** from a caller-supplied input field.  Use it when the path to write to is not known at definition time:

```ts
import { agent, p, s } from "rig";

// Agent role: render a changelog and write it to the caller-supplied path.
const renderer = agent({
  model: "mini",
  input: s.object({ outputPath: s.path }),
  instructions: p`Generate a changelog entry. ${p.writeInput("outputPath", "rendered")}`,
  output: s.object({ rendered: s.string }),
});

export default renderer;
```

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

`p.readInput(field)` reads the file at the **single** path held in the named input field.  It cannot accept an array field.  For an array of caller-supplied paths, use `p.readAllInput(field)` described in "Runtime lists of file paths" below.

The argument is the input field name, not the path itself. Passing full contents remains reasonable for small payloads; pass a path for larger files to reduce prompt size.

## Referencing non-path input values in prose

When you need to refer to a caller-supplied input value that is **not** a file path — such as an array of paths, a name, or a list — use `p.inputField(field)` to produce an explicit `"input.<field>"` reference in the prompt prose.  This replaces the opaque `${"input.fieldName"}` string literal:

```ts
import { agent, p, s } from "rig";

// Agent role: merge a caller-supplied list of JSON config files.
const configMerger = agent({
  model: "mini",
  input: s.object({ files: s.array(s.path) }),
  instructions: p`You are given a list of JSON config file paths: ${p.inputField("files")}\nRead and merge them into one combined config.`,
  output: s.object({ merged: s.unknown }),
});

export default configMerger;
```

`p.inputField("files")` returns the string `"input.files"`, which the model reads as a reference to the caller-supplied `files` field.  Use `p.readInput(field)` when the field holds a **single** file path whose contents the model should read; use `p.inputField(field)` when the field value itself (array, string, number, etc.) should appear in the prompt text.

## Runtime lists of file paths

When input contains an array of paths, use `p.readAllInput(field)` to read all files and concatenate their contents into a single prompt block.  This is the preferred pattern for multi-file inputs — it eliminates the need for prose-based iteration instructions.

```ts
import { agent, p, s } from "rig";

// Agent role: annotate all caller-supplied source files with JSDoc comments.
const fileAnnotator = agent({
  model: "mini",
  input: s.object({ files: s.array(s.path) }),
  instructions: p`Add JSDoc comments to each of the following files: ${p.readAllInput("files")}`,
  output: s.object({ annotations: s.array(s.string) }),
});

export default fileAnnotator;
```

When you need to process each file independently (e.g., call a subagent per file), use a coordinator + subagent pattern instead: let the coordinator iterate and delegate one file at a time to a subagent that uses `p.readInput("path")`.

```ts
import { agent, p, s } from "rig";

// Agent role: analyze one file path supplied at runtime.
const analyzeFile = agent({
  model: "mini",
  input: s.object({ path: s.path }),
  instructions: p`Analyze ${p.readInput("path")}.`,
  output: s.object({ summary: s.string }),
});

// Agent role: process every input file and return one combined report.
const analyzeAll = agent({
  model: "mini",
  input: s.object({ files: s.array(s.path) }),
  instructions: "For each input.files entry, call analyzeFile with { path } and combine the results.",
  output: s.object({ summaries: s.array(s.string) }),
  agents: { analyzeFile },
});

export default analyzeAll;
```

Likewise, there is no `p.readAll(globPattern)` helper: use `p.glob(...)` for discovery, then delegate per path.

## Dynamic shell commands

`p.bash(command)` and `p.bashRaw\`command\`` accept only **static strings** fixed at agent-definition time. There is no template-tag form that interpolates `input` values at call time. When the shell command must vary based on caller-supplied input, describe the command in the instructions prose and rely on the LLM to construct and execute it with the correct input values:

```ts
import { agent, p, s } from "rig";

// Agent role: analyze the diff between two caller-supplied git refs.
const diffAnalyzer = agent({
  model: "mini",
  input: s.object({ base: s.string, head: s.string }),
  // Describe the command; the model substitutes input.base and input.head.
  instructions: p`Run \`git diff --stat <input.base>..<input.head>\` and analyze the changes.`,
  output: s.object({ summary: s.string }),
});

export default diffAnalyzer;
```

Do not use `p.bash("git diff " + input.base)` — `input` is not in scope at definition time. The correct pattern is prose instructions that reference `input.<field>` by name.

When the **same command must run once per element** in a caller-supplied array, use `p.bashEach(template, inputArrayField)`.  Write `{}` in the template as the element placeholder:

```ts
import { agent, p, s } from "rig";

// Agent role: probe each caller-supplied URL and report its HTTP status.
const healthProbe = agent({
  model: "mini",
  input: s.object({ endpoints: s.array(s.url) }),
  instructions: p`${p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")}`,
  output: s.object({ results: s.array(s.object({ url: s.url, status: s.string })) }),
});

export default healthProbe;
```

`p.bashEach` is the correct choice when every element receives the same command template.  For commands that depend on multiple input fields or require branching logic, describe the full iteration strategy in prose instead.

## Failures

Shell and dynamic-read intents are instructions to the runtime/model. If a command exits non-zero or a dynamic file cannot be read, the resulting stderr or error message enters prompt context so the model can surface or recover from it.

Use `p.readOptional` for a literal path that may be absent; its fallback is inserted into prompt context as provided. For a dynamic path, tell the agent how to handle a missing file.
