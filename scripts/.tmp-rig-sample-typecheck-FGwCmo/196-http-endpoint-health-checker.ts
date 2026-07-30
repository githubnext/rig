import { agent, p, s, defineTool, repair } from "rig";

const checkEndpoint = defineTool("checkEndpoint", {
  description: "Probe an HTTP endpoint and return the status code and latency",
  parameters: s.object({ url: s.url }),
  async handler({ url }) {
    const { execSync } = await import("node:child_process");
    const start = Date.now();
    try {
      const code = execSync(
        `curl -o /dev/null -s -w '%{http_code}' --max-time 5 "${url}"`,
        { encoding: "utf8" },
      ).trim();
      return { statusCode: parseInt(code, 10), latencyMs: Date.now() - start };
    } catch {
      return { statusCode: 0, latencyMs: Date.now() - start };
    }
  },
});

// Agent role: probe each supplied HTTP endpoint and classify its health status.
const httpEndpointHealthChecker = agent({
  model: "typecheck",
  input: s.object({ endpoints: s.array(s.url) }),
  instructions: p`For each URL in ${p.inputField("endpoints")}, call checkEndpoint to get the HTTP status code. Classify: ok (2xx), redirect (3xx), client-error (4xx), server-error (5xx), timeout (0 with latency >= 5000), unreachable (0 with low latency).`,
  output: s.object({
    results: s.array(s.object({
      url: s.url,
      statusCode: s.int,
      status: s.enum("ok", "redirect", "client-error", "server-error", "timeout", "unreachable"),
      latencyMs: s.optional(s.int),
    })),
    healthyCount: s.int,
    totalCount: s.int,
    allHealthy: s.boolean,
  }),
  tools: [checkEndpoint],
  maxTurns: 5,
  addons: repair(),
});

export default httpEndpointHealthChecker;
