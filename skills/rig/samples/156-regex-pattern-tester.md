# 156 - Regex Pattern Tester

```rig
import { agent, defineTool, p, s } from "rig";
import { repair } from "rig/addons";

// Agent role: run regex patterns against test cases and report pass/fail results.
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
            expected: s.boolean,
          })
        ),
      })
    ),
  }),
  instructions: p`Run each regex pattern against its test cases and report results.

Input patterns and test cases:
${p.json("input")}

Use the runRegexTest tool for each (pattern, input) pair. Then build the results array
with patternName, input, expected, actual (from tool), and passed (expected === actual).
Count passCount and failCount. Set allPassed to true only if failCount is 0.`,
  tools: [
    defineTool("runRegexTest", {
      description: "Test a regex pattern against an input string",
      parameters: s.object({ pattern: s.string, input: s.string }),
      handler({ pattern, input }) {
        try {
          const matched = new RegExp(pattern).test(input);
          return { matched };
        } catch {
          return { matched: false };
        }
      },
    }),
  ],
  output: s.object({
    results: s.array(
      s.object({
        patternName: s.string,
        input: s.string,
        expected: s.boolean,
        actual: s.boolean,
        passed: s.boolean,
      })
    ),
    passCount: s.int,
    failCount: s.int,
    allPassed: s.boolean,
  }),
});

export default regexPatternTester;
```
