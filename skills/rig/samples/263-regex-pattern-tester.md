# 263 - Regex Pattern Tester

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Run regex patterns against test cases and report pass/fail results.
const regexPatternTester = agent({
  model: "small",
  addons: repair(),
  input: s.object({
    patterns: s.array(
      s.object({
        name: s.string,
        regex: s.string,
        testCases: s.array(
          s.object({
            input: s.string,
            shouldMatch: s.boolean,
          })
        ),
      })
    ),
  }),
  instructions: p`Run each regex pattern against its test cases and report results.

Input patterns and test cases:
${p.json("input")}

Use the runRegexTest tool for each pattern+testCase combination.
For each pattern, build a result with name, passed count, failed count, and allPassed.
Return results array, totalPatterns, passCount (patterns where allPassed=true),
failCount (patterns where allPassed=false), and overall allPassed.`,
  tools: [
    defineTool("runRegexTest", {
      description: "Test a regex pattern against an input string and return whether it matches.",
      parameters: s.object({ regex: s.string, input: s.string }),
      handler({ regex, input }) {
        try {
          return { matched: new RegExp(regex).test(input) };
        } catch (e) {
          return { matched: false, error: String(e) };
        }
      },
    }),
  ],
  output: s.object({
    results: s.array(
      s.object({
        name: s.string,
        passed: s.int,
        failed: s.int,
        allPassed: s.boolean,
      })
    ),
    totalPatterns: s.int,
    passCount: s.int,
    failCount: s.int,
    allPassed: s.boolean,
  }),
});

export default regexPatternTester;
```
