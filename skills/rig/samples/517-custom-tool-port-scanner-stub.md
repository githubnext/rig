# 517 - Custom Tool Port Scanner Stub

```rig
import { agent, defineTool, s } from "rig";

// Custom tool: simulate port reachability without real network calls.
const scanPorts = defineTool("scan_ports", {
  description: "Simulate reachability of ports on a host.",
  parameters: s.object({
    host: s.string,
    ports: s.array(s.number),
  }),
  handler: async ({ host: _host, ports }: { host: string; ports: number[] }) => {
    const result: Record<string, boolean> = {};
    for (const port of ports) {
      result[String(port)] = port < 1024 ? false : true;
    }
    return result;
  },
});

// Agent role: scan the given host/ports with the scan_ports tool and summarize results.
const portScanner = agent({
  model: "mini",
  instructions:
    "Call scan_ports with the provided host and ports, then summarize which ports are open and produce a short human-readable summary.",
  input: s.object({
    host: s.string,
    ports: s.array(s.number),
  }),
  output: s.object({
    openPorts: s.array(s.number),
    summary: s.string,
  }),
  tools: [scanPorts],
});

export default portScanner;
```
