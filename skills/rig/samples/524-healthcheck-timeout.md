# 524 - Healthcheck Timeout

```rig
import { agent, p, s, timeout } from "rig";

// Agent role: run a quick health-check command and report status within a timeout budget.
const healthProbe = agent({
  model: "small",
  addons: timeout({ timeout: 10_000 }),
  instructions: p`Run ${p.bash("curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://example.com || echo 000")} to probe service availability, measuring how long the command took in milliseconds. Report status as "ok" if the command returned a 2xx or 3xx HTTP code, "timeout" if the command appeared to hang or time out, and "error" otherwise. Report the elapsed duration in milliseconds as durationMs.`,
  output: s.object({
    status: s.enum("ok", "timeout", "error"),
    durationMs: s.number,
  }),
});

export default healthProbe;
```
