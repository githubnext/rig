# 172 - Service Health Probe

```rig
import { agent, p, s, steering } from "rig";

// Agent role: probe service health endpoints and classify status for each URL.
const serviceHealthProbe = agent({
  model: "small",
  addons: steering({ message: "For unexpected or missing HTTP codes, classify status as 'unknown' rather than failing." }),
  input: s.array(s.string),
  instructions: p`For each URL in the input array, run a curl probe using p.bashEach. Use ${p.bash("echo 'probe each URL with: curl -o /dev/null -s -w \\'%{http_code}\\' <url> --max-time 5'")} as a reference. For each URL in the input, probe it and classify its status: "up" (2xx), "down" (4xx/5xx/connection refused), "slow" (timeout), "unknown" (other). Compute healthyCount and overallStatus.`,
  output: s.object({
    endpoints: s.array(s.object({
      url: s.url,
      status: s.enum("up", "down", "slow", "unknown"),
      httpCode: s.int,
    })),
    healthyCount: s.int,
    overallStatus: s.enum("all-healthy", "degraded", "critical"),
  }),
});

export default serviceHealthProbe;
```
