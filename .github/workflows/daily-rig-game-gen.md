---
name: Daily Rig Game Generator
description: >
  Each day, generates a small self-contained rig program that produces a single-file
  game from an LLM-picked concept, then runs a bounded debugging-reflection loop that
  typechecks and executes the generated program end-to-end (no repo checkout — the
  rig CLI comes from the frontmatter `skills:` install), repairing exact compiler or
  runtime errors before reporting the outcome as a GitHub issue.
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
timeout-minutes: 30
checkout: false
skills:
  - githubnext/rig/skills/rig@4a8dfa2f79a12f09a6171c291c4ef288673674a8
pre-agent-steps:
  - name: Prepare standalone rig CLI shim (no repository checkout)
    run: |
      set -euo pipefail
      if [ ! -f .github/skills/rig/rig.ts ]; then
        echo "::error::rig skill was not installed at .github/skills/rig" >&2
        exit 1
      fi
      cat > package.json <<'PKGJSON'
      {
        "name": "rig",
        "private": true,
        "type": "module",
        "exports": {
          ".": "./.github/skills/rig/rig.ts",
          "./globals": "./.github/skills/rig/globals.ts"
        }
      }
      PKGJSON
      cat > tsconfig.json <<'TSCONFIG'
      {
        "compilerOptions": {
          "target": "ES2022",
          "module": "Node16",
          "moduleResolution": "Node16",
          "strict": true,
          "skipLibCheck": true,
          "noEmit": true,
          "allowImportingTsExtensions": true,
          "paths": { "rig": ["./.github/skills/rig/rig.ts"] }
        },
        "include": ["**/*.ts", "**/*.mts"]
      }
      TSCONFIG
      echo "Wrote standalone package.json + tsconfig.json pointing at .github/skills/rig"
tools:
  bash: ["*"]
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-issue:
    title-prefix: "[rig-game-gen] "
    labels: [automation, ai-agent]
    close-older-issues: true
    expires: 7
---

## Task

This workflow runs **without checking out the repository**. The `rig` skill is installed
directly from GitHub via the frontmatter `skills:` field (no `gh skill install --from-local`
step, no dependency on other repository files such as `skills/rig/samples/`). A
`pre-agent-steps` step writes a minimal `package.json` (`"name": "rig"`, with `exports`
pointing at the installed skill) and `tsconfig.json` (with a `paths` alias for `rig`) into
the workspace root so that generated programs importing `from "rig"` resolve correctly
both at typecheck time and at runtime, exactly as they would in the full repository.

Run this rig program:

```rig
import { agent, configureAgent, copilotEngine, defineTool, p, s } from "rig";

configureAgent(copilotEngine({ server: true }));

const RIG_ENTRY = ".github/skills/rig/rig.ts";
const MAX_ATTEMPTS = 3;

const GameConcept = s.object({
  title: s.string,
  genre: s.string,
  concept: s.string,
});

const Attempt = s.object({
  attempt: s.int,
  typecheckPassed: s.boolean,
  typecheckOutput: s.string,
  executePassed: s.boolean,
  executeOutput: s.string,
});

const GameGenReport = s.object({
  concept: GameConcept,
  attempts: s.array(Attempt),
  finalStatus: s.enum("passed", "failed"),
  finalProgramSource: s.string,
  finalGameFilename: s.string,
  finalGameLanguage: s.string,
  finalGameCode: s.string,
});

type RunResult = { code: number | null; stdout: string; stderr: string };

async function runRigEntry(programSource: string, flags: string[]): Promise<RunResult> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [RIG_ENTRY, ...flags], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += String(chunk); });
    child.on("error", rejectRun);
    child.on("close", (code: number | null) => resolveRun({ code, stdout, stderr }));
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
  const typecheck = await runRigEntry(source, ["--typecheck"]);
  if (typecheck.code !== 0) {
    return {
      typecheckPassed: false,
      typecheckOutput: (typecheck.stderr || typecheck.stdout).trim(),
      executePassed: false,
      executeOutput: "",
    };
  }
  const execution = await runRigEntry(source, ["--server"]);
  return {
    typecheckPassed: true,
    typecheckOutput: typecheck.stderr.trim(),
    executePassed: execution.code === 0,
    executeOutput: (execution.code === 0 ? execution.stdout : (execution.stderr || execution.stdout)).trim(),
  };
}

const verifyProgram = defineTool("verify_program", {
  description:
    "Typecheck and, if that passes, execute a rig TypeScript program via the installed rig CLI (piped over stdin; no file path, no repo checkout).",
  parameters: s.object({ source: s.string }),
  async handler({ source }: { source: string }) {
    return verifyProgramSource(source);
  },
});

// Agent role: pick one concrete, tractable single-file game concept.
const pickConcept = agent({
  name: "concept-picker",
  model: "small",
  instructions: p`Pick exactly one small, self-contained game concept suitable for a
single-file implementation: either a single-file HTML5 canvas game, or a short text/CLI
adventure. Prefer variety — avoid the most obvious choice (tic-tac-toe, snake) unless
nothing better fits. Return only the declared fields.`,
  output: GameConcept,
});

// Agent role: write one self-contained rig program that generates the actual game source.
const writeGameProgram = agent({
  name: "game-program-writer",
  model: "medium",
  maxTurns: 2,
  input: s.object({
    concept: GameConcept,
    priorSource: s.optional(s.string),
    priorError: s.optional(s.string),
  }),
  instructions: p`Write one complete rig TypeScript program (plain source text, no markdown
fences) that:
- imports only from "rig" (never from any other repository path — the program must be
  fully self-contained, since it will run with no repository checked out);
- defines exactly one agent with a "// Agent role: ..." comment above it, with no required
  input (omit \`input\` or use \`input: s.object({})\`) and
  \`output: s.object({ filename: s.string, language: s.enum("html", "js", "text"), code: s.string })\`;
- instructs that agent to generate a small, complete, runnable single-file game
  implementing this concept: ${p.inputField("concept")};
- exports that agent as the default export via \`export default\`, and never invokes it.

If a prior attempt and its exact error are given below, fix precisely the reported problem
and preserve everything that already worked. Do not introduce unrelated changes.
Prior source: ${p.inputField("priorSource")}
Prior error: ${p.inputField("priorError")}

Return only the plain TypeScript source in the "source" field.`,
  output: s.object({ source: s.string }),
});

const runGameGeneration = defineTool("run_game_generation", {
  description:
    "Pick a game concept, generate a self-contained rig program that builds the game, and run a bounded typecheck+execute debugging-reflection loop until it passes or attempts are exhausted.",
  parameters: s.object({}),
  async handler() {
    const concept = await pickConcept("");
    const attempts: Array<{
      attempt: number;
      typecheckPassed: boolean;
      typecheckOutput: string;
      executePassed: boolean;
      executeOutput: string;
    }> = [];

    let source = "";
    let priorError = "";
    let finalGameFilename = "";
    let finalGameLanguage = "";
    let finalGameCode = "";
    let passed = false;

    for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
      const writeInput = attemptNumber === 1
        ? { concept }
        : { concept, priorSource: source, priorError };
      const written = await writeGameProgram(writeInput);
      source = written.source;

      const verification = await verifyProgramSource(source);
      attempts.push({
        attempt: attemptNumber,
        typecheckPassed: verification.typecheckPassed,
        typecheckOutput: verification.typecheckOutput,
        executePassed: verification.executePassed,
        executeOutput: verification.executeOutput,
      });

      if (verification.typecheckPassed && verification.executePassed) {
        passed = true;
        try {
          const parsed = JSON.parse(verification.executeOutput) as {
            filename?: string;
            language?: string;
            code?: string;
          };
          finalGameFilename = parsed.filename ?? "";
          finalGameLanguage = parsed.language ?? "";
          finalGameCode = parsed.code ?? "";
        } catch {
          finalGameFilename = "";
          finalGameLanguage = "";
          finalGameCode = "";
        }
        break;
      }

      priorError = verification.typecheckPassed
        ? verification.executeOutput
        : verification.typecheckOutput;
    }

    return {
      concept,
      attempts,
      finalStatus: (passed ? "passed" : "failed") as "passed" | "failed",
      finalProgramSource: source,
      finalGameFilename,
      finalGameLanguage,
      finalGameCode,
    };
  },
});

// Agent role: run the game-generation debugging-reflection loop once and return its result unchanged.
const gameGenCoordinator = agent({
  name: "game-gen-coordinator",
  model: "small",
  tools: [verifyProgram, runGameGeneration],
  instructions: "Call run_game_generation exactly once with an empty object and return its result unchanged.",
  output: GameGenReport,
});

export default gameGenCoordinator;
```

Emit one `create-issue` safe output with:

- **title**: `Daily rig game generation — <YYYY-MM-DD> — <finalStatus>`
- **body**:
  - The chosen **game concept** (title, genre, one-paragraph concept).
  - Whether the final attempt's **typecheck passed** and whether its **execution passed**.
  - For each attempt in `attempts`, in order: the attempt number, typecheck pass/fail, and
    execute pass/fail, with the exact captured error text (if any) in a collapsible
    `<details>` block, and a one-line note on what was fixed in the next attempt (if any).
  - The **final generated rig program source** (`finalProgramSource`) in a collapsible
    `<details>` section with a ```ts fence.
  - If `finalStatus` is `passed`, the **final generated game code** (`finalGameCode`) with
    its `finalGameFilename` and `finalGameLanguage`, in a collapsible `<details>` section
    with an appropriately-fenced code block.
  - A final **pass/fail status** line: `✅ Passed on attempt N/MAX_ATTEMPTS` or
    `❌ Failed after MAX_ATTEMPTS attempts`.
  - Do not invent missing data — if a field is empty (e.g. execution never produced valid
    JSON), state that explicitly instead of fabricating content.
