import { agent, p, s } from "rig";

// Agent role: analyze a single GitHub Actions workflow file for structural issues and job count.
const workflowAnalyzer = agent({
  name: "workflowAnalyzer",
  model: "typecheck",
  input: s.object({ filePath: s.path }),
  instructions: p`Analyze the GitHub Actions workflow file at ${p.readInput("filePath")} for issues such as missing permissions, deprecated actions, hardcoded secrets, or missing timeout-minutes. Count the number of jobs defined.`,
  output: s.object({
    issues: s.array(s.object({
      step: s.string,
      problem: s.string,
      severity: s.enum("error", "warning", "info"),
    })),
    jobCount: s.int,
  }),
});

// Agent role: find all GitHub Actions workflow files and delegate analysis to workflowAnalyzer subagent, then aggregate results.
const workflowValidator = agent({
  model: "typecheck",
  instructions: p`Find GitHub Actions workflow files using ${p.bash("find .github/workflows -name '*.yml' -o -name '*.yaml' 2>/dev/null | head -10 || echo 'no workflows'")} then delegate each file to the workflowAnalyzer subagent. Aggregate results keyed by filename, adding a pass/warn/fail status based on issue severity.`,
  output: s.record(s.object({
    issues: s.array(s.object({
      step: s.string,
      problem: s.string,
      severity: s.enum("error", "warning", "info"),
    })),
    jobCount: s.int,
    status: s.enum("pass", "warn", "fail"),
  })),
  agents: { workflowAnalyzer },
});

export default workflowValidator;

