# 126 - Tsconfig Options Auditor

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const checkOption = defineTool("checkOption", {
  description: "Check whether a tsconfig compiler option matches the recommended value",
  parameters: s.object({
    option: s.string,
    value: s.unknown,
    recommended: s.unknown,
  }),
  handler: ({ value, recommended }) => {
    return JSON.stringify(value) === JSON.stringify(recommended) ? "pass" : "fail";
  },
});

// Agent role: audit TypeScript compiler options against best-practice recommendations
const tsconfigOptionsAuditor = agent({
  name: "tsconfigOptionsAuditor",
  model: "small",
  addons: [steering(), repair()],
  instructions: p`Audit TypeScript compiler options in this project against best-practice recommendations.

tsconfig.json: ${p.readOptional("tsconfig.json", "{}")}

tsconfig.base.json: ${p.readOptional("tsconfig.base.json", "{}")}

Check the following recommended settings using the checkOption tool:
- strict: true
- noImplicitAny: true
- strictNullChecks: true
- noUnusedLocals: true
- noUnusedParameters: true
- exactOptionalPropertyTypes: true
- noFallthroughCasesInSwitch: true
- esModuleInterop: true
- skipLibCheck: true
- forceConsistentCasingInFileNames: true

Determine complianceLevel: strict (9–10 pass), moderate (6–8 pass), loose (3–5 pass), unconfigured (<3 pass).
Return all options checked with status and reason.`,
  output: s.object({
    options: s.array(
      s.object({
        name: s.string,
        currentValue: s.unknown,
        recommendedValue: s.unknown,
        status: s.enum("pass", "fail", "missing", "warn"),
        reason: s.string,
      })
    ),
    complianceLevel: s.enum("strict", "moderate", "loose", "unconfigured"),
    totalChecked: s.int,
    passCount: s.int,
  }),
  tools: [checkOption],
});

export default tsconfigOptionsAuditor;
```
