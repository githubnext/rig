# 23 - Schema Inference

```rig
import { agent, p, s } from "rig";
// Agent role: normalize the config into a JSON-compatible object.
const normalize = agent({
    model: "mini",
    output: s.object({
        normalized: s.unknown,
        warnings: s.array(s.string)
    }),
    instructions: `Normalize the config into a JSON-compatible object.`,
});

export default normalize;
```
