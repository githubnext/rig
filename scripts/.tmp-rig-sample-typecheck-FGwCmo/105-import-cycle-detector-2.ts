import { agent, p, s, repair } from "rig";

// Agent role: detect circular import cycles in TypeScript source files.
const importCycleDetector = agent({
  model: "typecheck",
  instructions: p`Detect circular imports in TypeScript files. Check using: ${p.bash("npx --yes madge --circular --extensions ts . 2>&1 || echo 'madge-unavailable'")}. If madge is unavailable, fall back to analyzing imports manually: ${p.bash("grep -rn \"^import\" --include='*.ts' . | grep -v node_modules | head -50")}. For each detected cycle, list the file path chain and assign severity: high (3+ files), medium (2 files shared between critical paths), low (leaf-only cycles).`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(s.object({
      path: s.array(s.string),
      severity: s.enum("high", "medium", "low"),
    })),
  }),
  maxTurns: 5,
  addons: repair(),
});

export default importCycleDetector;
