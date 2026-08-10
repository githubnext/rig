---
name: Daily Rig Decomposition Benchmark
description: >
  Each day, picks one complicated task that would typically benefit from being split
  across sub-agents and sub-models (research, multi-step coding, structured content
  generation, etc.), then solves it two ways — a single model call attempting the whole
  task at once, and a self-contained rig program that decomposes it into sub-agents each
  free to pick their own model — before running a bounded debugging-reflection loop that
  typechecks and executes the decomposed program end-to-end (no repo checkout — the rig
  CLI comes from the frontmatter `skills:` install), grading both solutions against the same criteria, and
  reporting the comparison as a GitHub issue.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  copilot-requests: write
engine:
  id: copilot
  copilot-sdk: true
strict: true
timeout-minutes: 55
checkout: false
skills:
  - githubnext/rig/skills/rig@e7d6ad85cd93946a8c09ebbdc1280ca62abd9de5
tools:
  bash: ["*"]
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-issue:
    title-prefix: "[rig-decomposition-bench] "
    labels: [automation, ai-agent]
    close-older-issues: true
    expires: 7
---

## Task

This workflow runs **without checking out the repository**. The `rig` skill is installed
directly from GitHub via the frontmatter `skills:` field only — nothing beyond that
install is prepared: the skill itself ships its own `package.json` (`"name": "rig"`, with
`exports` pointing at its own `rig.ts`/`globals.ts`) and `tsconfig.json`, so generated
programs importing `from "rig"` resolve correctly both at typecheck time and at runtime as
long as the rig CLI subprocess is run with its working directory set to the installed
skill directory (`.github/skills/rig`).

Run this rig program:

```rig
import { agent, configureAgent, copilotEngine, p, s, workflow } from "rig";

configureAgent(copilotEngine({ server: true }));

const RIG_SKILL_DIR = ".github/skills/rig";
const RIG_ENTRY = `${RIG_SKILL_DIR}/rig.ts`;
const MAX_ATTEMPTS = 2;
const TYPECHECK_TIMEOUT_MS = 2 * 60 * 1000;
const EXECUTE_TIMEOUT_MS = 5 * 60 * 1000;
// Hard wall-clock budget for the whole benchmark, well below the job's
// `timeout-minutes`, so the outer agent always has time left to file the issue.
const BENCH_DEADLINE = Date.now() + 25 * 60 * 1000;

const msLeft = () => BENCH_DEADLINE - Date.now();

const TaskSpec = s.object({
  title: s.string,
  domain: s.string,
  description: s.string,
  successCriteria: s.array(s.string),
});

const Grading = s.object({
  singleCallScore: s.number,
  decomposedScore: s.number,
  winner: s.enum("single-call", "decomposed", "tie"),
  rationale: s.string,
});

type RunResult = { code: number | null; stdout: string; stderr: string };

async function runRigEntry(
  programSource: string,
  flags: string[],
  timeoutMs: number,
): Promise<RunResult> {
  if (timeoutMs <= 0) {
    return { code: null, stdout: "", stderr: "[skipped: benchmark time budget exhausted]" };
  }
  const { spawn } = await import("node:child_process");
  const { resolve: resolvePath } = await import("node:path");
  const rigEntryPath = resolvePath(process.cwd(), RIG_ENTRY);
  const rigSkillDir = resolvePath(process.cwd(), RIG_SKILL_DIR);
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [rigEntryPath, ...flags], {
      // Run with cwd set to the installed skill directory (not the workspace
      // root, which has no repository checkout) so that Node's package
      // self-reference resolves bare `from "rig"` imports via the skill's own
      // package.json, both for typecheck and for the temp files it writes
      // under its own `.tmp/` during execution.
      cwd: rigSkillDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\n[timed out after ${Math.round(timeoutMs / 1000)}s]`;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += String(chunk); });
    child.on("error", (error) => { clearTimeout(timer); rejectRun(error); });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolveRun({ code: timedOut ? null : code, stdout, stderr });
    });
    child.stdin.end(programSource);
  });
}

type VerifyResult = {
  typecheckPassed: boolean;
  typecheckOutput: string;
  executePassed: boolean;
  executeOutput: string;
};

async function verifyProgramSource(source: string): Promise<VerifyResult> {
  const typecheck = await runRigEntry(
    source,
    ["--typecheck"],
    Math.min(TYPECHECK_TIMEOUT_MS, msLeft()),
  );
  if (typecheck.code !== 0) {
    return {
      typecheckPassed: false,
      typecheckOutput: (typecheck.stderr || typecheck.stdout).trim(),
      executePassed: false,
      executeOutput: "",
    };
  }
  const execution = await runRigEntry(
    source,
    ["--server"],
    Math.min(EXECUTE_TIMEOUT_MS, msLeft()),
  );
  return {
    typecheckPassed: true,
    typecheckOutput: typecheck.stderr.trim(),
    executePassed: execution.code === 0,
    executeOutput: (execution.code === 0 ? execution.stdout : (execution.stderr || execution.stdout)).trim(),
  };
}

// Agent role: pick one concrete, complicated daily task that is naturally suited to
// being split across multiple sub-agents and sub-models rather than solved in one shot.
const pickTask = agent({
  name: "task-picker",
  model: "small",
  instructions: p`Pick exactly one complicated task that a person or team might face in a
single day and that would typically benefit from delegating parts of it to sub-agents
running different models (e.g. multi-source research and synthesis, a multi-file coding
task with distinct design/implementation/review phases, a structured report combining
several independent analyses, or a multi-step data transformation pipeline). The task
must be self-contained (solvable from the description alone, no external file access or
live web access) and concrete enough to grade. Prefer variety across domains from run to
run. List 3-6 concrete, checkable success criteria. Return only the declared fields.`,
  output: TaskSpec,
});

// Agent role: attempt the entire task in a single model call, unaided, as the baseline.
const solveSingleCall = agent({
  name: "single-call-solver",
  model: "medium",
  maxTurns: 1,
  input: s.object({ task: TaskSpec }),
  instructions: p`Solve this task completely by yourself in a single response, without
delegating to any other agent or tool: ${p.inputField("task")}
Address every success criterion listed. Return the complete solution as plain text in the
"solution" field.`,
  output: s.object({ solution: s.string }),
});

// Agent role: write one self-contained rig program that decomposes the task across
// sub-agents, letting each sub-agent pick the model appropriate to its slice of work.
const writeDecomposedProgram = agent({
  name: "decomposition-program-writer",
  model: "medium",
  maxTurns: 2,
  input: s.object({
    task: TaskSpec,
    priorSource: s.optional(s.string),
    priorError: s.optional(s.string),
  }),
  instructions: p`Write one complete rig TypeScript program (plain source text, no markdown
fences) that:
- imports only from "rig" (never from any other repository path — the program must be
  fully self-contained, since it will run with no repository checked out);
- defines at least two agents, each with a "// Agent role: ..." comment above it, that
  decompose this task into distinct sub-steps (e.g. plan/research vs. draft/implement vs.
  review/combine), assigning "small" to simple sub-steps and "medium" or "large" to
  harder ones;
- coordinates those agents from one root agent or a plain async function so the final
  result is produced by combining the sub-agents' outputs, not by a single agent solving
  the whole task alone;
- has no required input on the root export (omit \`input\` or use \`input: s.object({})\`)
  and \`output: s.object({ solution: s.string })\` containing the final combined solution
  addressing this task: ${p.inputField("task")};
- exports the root agent as the default export via \`export default\`, and never invokes it.

If a prior attempt and its exact error are given below, fix precisely the reported problem
and preserve everything that already worked. Do not introduce unrelated changes.
Prior source: ${p.inputField("priorSource")}
Prior error: ${p.inputField("priorError")}

Return only the plain TypeScript source in the "source" field.`,
  output: s.object({ source: s.string }),
});

// Agent role: grade the single-call solution against the decomposed solution against
// the task's success criteria, judging on content alone rather than length or origin.
const gradeSolutions = agent({
  name: "solution-grader",
  model: "large",
  maxTurns: 1,
  input: s.object({
    task: TaskSpec,
    solutionA: s.string,
    solutionB: s.string,
  }),
  instructions: p`Grade two candidate solutions ("A" — the single-call solution, "B" — the
decomposed solution) to this task, against its success criteria: ${p.inputField("task")}
Solution A: ${p.inputField("solutionA")}
Solution B: ${p.inputField("solutionB")}
Score each solution from 0-10 on how completely and correctly it satisfies the success
criteria. Return "singleCallScore" for A's score, "decomposedScore" for B's score, a
"winner" of "single-call", "decomposed", or "tie", and a "rationale" explaining the
comparison. Judge on correctness and completeness of content only — do not let solution
length or which approach produced it bias the score.`,
  output: Grading,
});

// Workflow role: orchestrate the benchmark deterministically in TypeScript — no LLM
// coordinator relays the (large) report, so nothing is spent re-emitting it as JSON.
const decompositionBenchmark = workflow({
  meta: {
    name: "decomposition-bench",
    description:
      "Pick a task suited to decomposition, solve it once with a single model call and once with a decomposed rig program, then grade both solutions against the same criteria.",
    phases: ["Pick task", "Single call", "Decompose", "Grade"],
  },
  body: async ({ phase, log }) => {
    phase("Pick task");
    const task = await pickTask("");

    phase("Single call");
    const singleCallStart = Date.now();
    const singleCall = await solveSingleCall({ task });
    const singleCallDurationMs = Date.now() - singleCallStart;

    phase("Decompose");
    const decomposedAttempts: Array<{
      attempt: number;
      typecheckPassed: boolean;
      typecheckOutput: string;
      executePassed: boolean;
      executeOutput: string;
    }> = [];

    const decomposedStart = Date.now();
    let source = "";
    let priorError = "";
    let decomposedSolution = "";
    let passed = false;

    for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
      if (msLeft() <= TYPECHECK_TIMEOUT_MS) {
        log(`stopping after ${attemptNumber - 1} attempt(s): benchmark time budget exhausted`);
        break;
      }
      const writeInput = attemptNumber === 1
        ? { task }
        : { task, priorSource: source, priorError };
      const written = await writeDecomposedProgram(writeInput);
      source = written.source;

      const verification = await verifyProgramSource(source);
      decomposedAttempts.push({
        attempt: attemptNumber,
        typecheckPassed: verification.typecheckPassed,
        typecheckOutput: verification.typecheckOutput,
        executePassed: verification.executePassed,
        executeOutput: verification.executeOutput,
      });

      if (verification.typecheckPassed && verification.executePassed) {
        passed = true;
        try {
          const parsed = JSON.parse(verification.executeOutput) as { solution?: string };
          decomposedSolution = parsed.solution ?? "";
        } catch {
          decomposedSolution = "";
        }
        break;
      }

      priorError = verification.typecheckPassed
        ? verification.executeOutput
        : verification.typecheckOutput;
    }
    const decomposedDurationMs = Date.now() - decomposedStart;

    phase("Grade");
    const grading = await gradeSolutions({
      task,
      solutionA: singleCall.solution,
      solutionB: decomposedSolution || "(decomposed program failed to produce a solution)",
    });

    return {
      task,
      singleCallDurationMs,
      singleCallSolution: singleCall.solution,
      decomposedAttempts,
      decomposedFinalStatus: (passed ? "passed" : "failed") as "passed" | "failed",
      decomposedDurationMs,
      decomposedProgramSource: source,
      decomposedSolution,
      grading,
    };
  },
});

export default decompositionBenchmark;
```

Run the program exactly once. Do not edit, rewrite, re-run, or debug it: it already
bounds itself with an internal 25-minute wall-clock budget and per-subprocess timeouts,
and re-running it would exceed this job's `timeout-minutes`. If the run fails or produces
no output, report that failure (with the captured stderr) in the issue instead of
retrying.

Emit one `create-issue` safe output with:

- **title**: `Daily rig decomposition benchmark — <YYYY-MM-DD> — <winner>`
- **body**:
  - The chosen **task** (title, domain, one-paragraph description, success criteria list).
  - A **timing comparison** table: single-call duration vs. decomposed duration (ms), and
    the decomposed program's final pass/fail status.
  - For each attempt in `decomposedAttempts`, in order: the attempt number, typecheck
    pass/fail, and execute pass/fail, with the exact captured error text (if any) in a
    collapsible `<details>` block, and a one-line note on what was fixed in the next
    attempt (if any).
  - The **grading** results: `singleCallScore`, `decomposedScore`, `winner`, and the
    grader's `rationale`, verbatim.
  - The complete, verbatim **single-call solution** (`singleCallSolution`) in a collapsible
    `<details>` block.
  - The complete, verbatim **decomposed rig program source** (`decomposedProgramSource`) in
    a ```ts fence, and the **decomposed solution** (`decomposedSolution`) in a collapsible
    `<details>` block. Never summarize, truncate, replace, or omit any part of the program
    source, regardless of the final status.
  - A final **verdict** line naming the winner and summarizing why in one sentence.
  - Do not invent missing data — if a field is empty (e.g. execution never produced valid
    JSON), state that explicitly instead of fabricating content.
