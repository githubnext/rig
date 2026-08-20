# 438 - TypeScript Interface Method Counter

```rig
import { agent, workflow, p, s, defineTool } from "rig";

const countMethods = defineTool("countMethods", {
  description: "Count method signatures in TypeScript interface blocks from raw text",
  parameters: s.object({ content: s.string }),
  handler: async ({ content }) => {
    const methods = (content.match(/^\s+\w+\s*\(/gm) ?? []).length;
    return { methodCount: methods };
  },
});

// Agent role: Scan TypeScript files for interface declarations and extract raw interface blocks.
const interfaceScanner = agent({
  name: "interface-scanner",
  model: "small",
  maxTurns: 4,
  instructions: p`Here are TypeScript source files:
${p.glob("src/**/*.ts")}
Extract all interface declarations from each file. Return the raw interface text blocks concatenated, and the list of file paths scanned.`,
  output: s.object({
    interfaceBlocks: s.string,
    filesScanned: s.array(s.path),
  }),
});

// Agent role: Count methods in each interface block and return aggregated statistics.
const methodCounter = agent({
  name: "method-counter",
  model: "small",
  maxTurns: 4,
  input: s.object({ interfaceBlocks: s.string, filesScanned: s.array(s.path) }),
  instructions: p`You have interface block text from TypeScript files. Count methods in each interface by calling countMethods with the relevant block. Return interfaces (a record of interface name to method count), totalInterfaces, totalMethods, and largestInterface.`,
  output: s.object({
    interfaces: s.record(s.int),
    totalInterfaces: s.int,
    totalMethods: s.int,
    largestInterface: s.string,
  }),
  tools: [countMethods],
});

// Workflow role: Scan TypeScript files for interfaces then count methods per interface.
const tsInterfaceMethodCounterWorkflow = workflow({
  meta: { name: "ts-interface-method-counter", description: "Count methods per TypeScript interface across source files" },
  body: async ({ call }) => {
    const scan = await call(interfaceScanner, "scan interfaces");
    const result = await call(methodCounter, scan ?? { interfaceBlocks: "", filesScanned: [] });
    return result;
  },
});

export default tsInterfaceMethodCounterWorkflow;
```
