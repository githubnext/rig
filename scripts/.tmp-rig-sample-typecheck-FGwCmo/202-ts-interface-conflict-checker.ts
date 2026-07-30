import { agent, p, s, defineTool, repair } from "rig";

const scanInterfaces = defineTool("scanInterfaces", {
  description: "Scan a TypeScript file for exported interface names using grep",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const { execSync } = await import("node:child_process");
    try {
      const result = execSync(
        `grep -n "^export interface\\|^interface " "${filePath}" 2>/dev/null || true`,
        { encoding: "utf8" }
      );
      const names = result
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/interface\s+(\w+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean) as string[];
      return { filePath, names };
    } catch {
      return { filePath, names: [] };
    }
  },
});

// Agent role: find duplicate TypeScript interface names across all source files.
const tsInterfaceConflictCheckerV2 = agent({
  model: "typecheck",
  instructions: p`Discover TypeScript source files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -80")}. Use the scanInterfaces tool on each file to collect interface names. Identify interface names declared in more than one file. Classify each conflict as error when names are likely to clash at runtime, warning otherwise. Set hasConflicts to true if any conflicts exist.`,
  output: s.object({
    conflicts: s.array(s.object({
      interfaceName: s.string,
      files: s.array(s.string),
      severity: s.enum("warning", "error"),
    })),
    hasConflicts: s.boolean,
  }),
  tools: [scanInterfaces],
  maxTurns: 6,
  addons: repair(),
});

export default tsInterfaceConflictCheckerV2;
