# 05 - Write Readme Intent

```rig
import { agent, p, s } from "rig";
// Agent role: generate a concise README for the package. Include install, usage, and API sections.
const readmeWriter = agent({
    model: "mini",
    output: s.object({
        path: s.enum("README.md"),
        contents: s.string
    }),
    instructions: `
    Generate a concise README for the package.
    Include install, usage, and API sections.
  `,
});

export default readmeWriter;
```
