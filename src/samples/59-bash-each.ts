import { agent, p, s } from "rig";

// Agent role: probe each endpoint and report its HTTP status code.
const healthProbe = agent({
  model: "small",
  input: s.object({ endpoints: s.array(s.url) }),
  instructions: p`${p.bashEach("curl -s -o /dev/null -w '%{http_code}' {} --max-time 5", "endpoints")}`,
  output: s.object({
    results: s.array(s.object({ url: s.url, status: s.string })),
    allHealthy: s.boolean,
  }),
});

await healthProbe({
  endpoints: ["https://example.com/health", "https://api.example.com/ping"],
});

export default healthProbe;
