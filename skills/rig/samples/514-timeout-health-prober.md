# 514 - Timeout Health Prober

```rig
import { agent, p, s, timeout } from "rig";

// Agent role: run a bash health-check probe and report its timing and status.
const healthProber = agent({
  model: "mini",
  instructions: p`Run the health-check command ${p.bash("sleep 1 && echo ok")} and report the outcome.
If the command output contains "ok", set status to "ok". If the command did not complete or you were cut off before finishing, set status to "timeout". If any other error occurred, set status to "error".
Estimate durationMs as the elapsed time in milliseconds for the command to run.`,
  output: s.object({
    status: s.enum("ok", "timeout", "error"),
    durationMs: s.number,
  }),
  addons: timeout({ timeout: 5_000 }),
});

export default healthProber;
```
