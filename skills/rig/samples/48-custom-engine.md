# 48 - Copilot Runtime

Launch this sample with `node skills/rig/rig.ts --server` when you want stdio mode.

```rig
import { agent, s } from "rig";
// Agent role: explain when to launch rig with --server.
const review = agent({
  model: "mini",
  instructions: "Explain when to launch rig with --server instead of connecting to an HTTP Copilot server.",
  output: s.object({ summary: s.string, recommendedMode: s.enum("http", "server") }),
});
export default review;
```
