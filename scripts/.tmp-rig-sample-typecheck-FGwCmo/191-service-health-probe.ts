import { agent, p, s, steering } from "rig";

// Agent role: probe HTTP endpoints and classify their health status.
const serviceHealthProbe = agent({
  model: "typecheck",
  input: s.object({
    urls: s.array(s.string),
  }),
  instructions: p`You are a service health probe.

For each URL in the input list, run: curl -o /dev/null -s -w '%{http_code}' <url>
using the command once per element.
${p.bashEach("curl -o /dev/null -s -w '%{http_code}' --max-time 5 {}", "urls")}

Classify each endpoint:
- "up": HTTP 2xx
- "down": HTTP 5xx or connection refused
- "slow": HTTP 408 or timeout
- "unknown": anything else

Count healthy endpoints (status "up") and set overallStatus:
- "all-healthy": all up
- "degraded": some up
- "critical": none up`,
  addons: [steering({ message: "Re-check any endpoint that returned an ambiguous or unexpected status code before finalizing." })],
  output: s.object({
    endpoints: s.array(s.object({
      url: s.url,
      status: s.enum("up", "down", "slow", "unknown"),
      httpCode: s.optional(s.int),
    })),
    healthyCount: s.int,
    overallStatus: s.enum("all-healthy", "degraded", "critical"),
  }),
});

export default serviceHealthProbe;
