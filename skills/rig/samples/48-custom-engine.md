# 48 - Pi Runtime

The harness starts Pi in RPC mode automatically.

```rig
import { agent, s } from "rig";
// Agent role: explain how rig uses the Pi runtime.
const review = agent({
  model: "github-copilot/gpt-5.4-mini",
  instructions: "Explain how rig runs agents through Pi RPC sessions.",
  output: s.object({ summary: s.string, transport: s.enum("rpc") }),
});
export default review;
```
