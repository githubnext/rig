import { agent, s, defineTool, repair } from "rig";

const runRegexTest = defineTool("runRegexTest", {
  description: "Test a regex pattern against an input string and return whether it matches.",
  parameters: s.object({ regex: s.string, input: s.string }),
  handler({ regex, input }) {
    try {
      const matched = new RegExp(regex).test(input);
      return { matched, error: undefined };
    } catch (e) {
      return { matched: false, error: String(e) };
    }
  },
});

// Agent role: run all test cases for each regex pattern and report pass/fail results.
const regexPatternTester = agent({
  model: "typecheck",
  addons: repair(),
  input: s.object({
    patterns: s.array(
      s.object({
        name: s.string,
        regex: s.string,
        testCases: s.array(
          s.object({ input: s.string, shouldMatch: s.boolean })
        ),
      })
    ),
  }),
  instructions: `For each pattern in the input, call runRegexTest for every test case.
A test case passes when the matched result equals shouldMatch.
Collect failedCases (input, expected, got) for each pattern.
A pattern passes when all test cases pass.
Count passCount (patterns where passed=true) and failCount.
allPassed is true when failCount === 0.`,
  tools: [runRegexTest],
  output: s.object({
    results: s.array(
      s.object({
        name: s.string,
        passed: s.boolean,
        failedCases: s.array(
          s.object({ input: s.string, expected: s.boolean, got: s.boolean })
        ),
      })
    ),
    passCount: s.int,
    failCount: s.int,
    allPassed: s.boolean,
  }),
});

export default regexPatternTester;
