# 99 - Bash Each

```rig
import { agent, p, s } from "rig";

const ProbeResult = s.object({
  results: s.array(s.object({ url: s.url, status: s.string })),
  allHealthy: s.boolean,
});

// Agent role: probe each endpoint and report its HTTP status code.
const endpointProbe = agent({
  name: "endpointProbe",
  model: "small",
  input: s.object({ endpoints: s.array(s.url) }),
  instructions: p`${p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")}`,
  output: ProbeResult,
});

// Agent role: supply the endpoint list and delegate probing to endpointProbe.
const healthProbe = agent({
  model: "small",
  agents: { endpointProbe },
  instructions: p`Delegate to endpointProbe with endpoints ["https://example.com", "https://example.org"], then return its result unchanged.`,
  output: ProbeResult,
});

export default healthProbe;
```
