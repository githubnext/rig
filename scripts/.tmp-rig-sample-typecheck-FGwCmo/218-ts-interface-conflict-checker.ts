import { agent, p, s, defineTool, steering, repair } from "rig";

const extractInterface = defineTool("extractInterface", {
  description: "Extract field names from a TypeScript interface declaration in a file",
  parameters: s.object({
    filePath: s.string,
    interfaceName: s.string,
  }),
  async handler({ filePath, interfaceName }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const text = await readFile(filePath, "utf8");
      const pattern = new RegExp(`interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`, "s");
      const match = text.match(pattern);
      if (!match) return { fields: [] };
      const body = match[1];
      const fields = body
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.startsWith("//") && !l.startsWith("*"))
        .map((l: string) => l.split(":")[0].replace(/[?;]/g, "").trim())
        .filter(Boolean);
      return { fields };
    } catch {
      return { fields: [] };
    }
  },
});

// Agent role: detect TypeScript interfaces with the same name across multiple source files.
const tsInterfaceConflictChecker = agent({
  model: "typecheck",
  instructions: p`Find TypeScript interface declarations: ${p.bash("grep -rn 'interface ' --include='*.ts' . | grep -v node_modules | grep -v '.d.ts' | head -60")}. Use the extractInterface tool to get fields for each interface found. Detect interface names that appear in more than one file — those are conflicts. Report them with their file list and conflicting field names. Set conflictCount to the number of conflicting interface names.`,
  output: s.object({
    interfaces: s.record(s.object({
      fields: s.array(s.string),
      file: s.path,
      hasConflict: s.boolean,
    })),
    conflicts: s.array(s.object({
      name: s.string,
      files: s.array(s.path),
      conflictingFields: s.array(s.string),
    })),
    conflictCount: s.int,
  }),
  tools: [extractInterface],
  maxTurns: 6,
  addons: [steering(), repair()],
});

export default tsInterfaceConflictChecker;
