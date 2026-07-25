# 72 - Ts Function Signatures

```rig
import { agent, p, s, defineTool } from "rig";

const parseSignatures = defineTool("parseSignatures", {
  description: "Extract function signatures from TypeScript source content using regex",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const pattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    const functions: { name: string; paramCount: number; isExported: boolean }[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [full, name, params] = match;
      const paramCount = params.trim() === "" ? 0 : params.split(",").length;
      const isExported = full.trimStart().startsWith("export");
      functions.push({ name, paramCount, isExported });
    }
    return { functions };
  },
});

// Agent role: extract TypeScript function signatures from source files and return them keyed by file path.
const tsFunctionSignatures = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.bash("find src -name '*.ts' 2>/dev/null | head -5 || echo 'no files'")} then read each file and use the parseSignatures tool to extract function signatures. Return results keyed by file path.`,
  output: s.record(s.array(s.object({
    name: s.string,
    paramCount: s.int,
    isExported: s.boolean,
  }))),
  tools: [parseSignatures],
});

export default tsFunctionSignatures;

```
