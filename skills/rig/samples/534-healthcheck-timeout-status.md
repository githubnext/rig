# 534 - Healthcheck Timeout Status

```rig
import { agent, p, s, timeout } from "rig";

// Agent role: run a health-check command and report its status within a time budget.
const healthCheck = agent({
  model: "small",
  instructions: p`Run ${p.bash("node --version")} as a health-check probe. Report
    "ok" if it succeeded, "error" if it failed, or "timeout" if it did not
    complete, along with the approximate duration in milliseconds.`,
  output: s.object({
    status: s.enum("ok", "timeout", "error"),
    durationMs: s.number,
  }),
  addons: timeout({ timeout: 15_000 }),
});

export default healthCheck;
```
