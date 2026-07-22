# 40 - Record Output

```rig
import { agent, p, s } from "rig";
// Agent role: extract any JSON object from input.text into raw.
const extractJson = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        raw: s.unknown,
        summary: s.string
    }),
    instructions: `Extract any JSON object from input.text into raw.`,
});

export default extractJson;
```
