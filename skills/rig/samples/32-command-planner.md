# 32 - Command Planner

```rig
import { agent, p, s } from "rig";
// Agent role: build a package map for a JavaScript monorepo.
const packageMap = agent({
    model: "mini",
    output: s.object({
        packages: s.array(s.object({
            name: s.string,
            path: s.string,
            private: s.boolean
        })),
        relationships: s.array(s.object({
            from: s.string,
            to: s.string,
            kind: s.string
        }))
    }),
    instructions: `Build a package map for a JavaScript monorepo.`,
});

export default packageMap;
```
