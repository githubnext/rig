# 181 - Service Health Probe

```rig
import { agent, p, s, steering } from "rig";

// Agent role: probe each URL endpoint and classify its health status.
const serviceHealthProbe = agent({
  model: "small",
  addons: [steering({ message: "For any URL that times out or returns a non-standard code, classify as 'unknown' rather than failing." })],
  instructions: p`Probe the comma-separated URLs in ${p.env("HEALTH_CHECK_URLS", "https://example.com,https://example.org")} using curl: ${p.bash("echo 'example: curl -o /dev/null -s -w \\'%{http_code}\\' --max-time 5 <url>'")}. Run a separate curl command for each URL. Classify each: 'up' (2xx), 'down' (4xx/5xx/refused), 'slow' (timeout after 5s), 'unknown' (other). Count healthyCount and determine overallStatus: 'all-healthy' if all up, 'critical' if more than half are down, otherwise 'degraded'.`,
  output: s.object({
    endpoints: s.array(s.object({
      url: s.url,
      status: s.enum("up", "down", "slow", "unknown"),
      httpCode: s.optional(s.int),
      responseTimeMs: s.optional(s.int),
    })),
    healthyCount: s.int,
    overallStatus: s.enum("all-healthy", "degraded", "critical"),
  }),
});

export default serviceHealthProbe;
```
