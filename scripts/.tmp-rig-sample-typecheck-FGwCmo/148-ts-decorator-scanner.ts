import { agent, p, s, defineTool } from "rig";

const classifyDecorator = defineTool("classifyDecorator", {
  description: "Classify a decorator as class, method, property, or parameter based on context.",
  parameters: s.object({ name: s.string, context: s.string }),
  handler({ context }) {
    const trimmed = context.trim();
    if (/^@\w+\s*\n?\s*(export\s+)?(abstract\s+)?class\s+/.test(trimmed) ||
        /class\s+\w+/.test(trimmed)) {
      return { type: "class" };
    }
    if (/\(.*:/.test(trimmed) && trimmed.includes("constructor")) {
      return { type: "parameter" };
    }
    if (/^\s*(public|private|protected|readonly)/.test(trimmed) ||
        /\w+\s*[=:!]/.test(trimmed)) {
      return { type: "property" };
    }
    return { type: "method" };
  },
});

// Agent role: Scan TypeScript files for decorator usage and classify each by decorator type.
const tsDecoratorScanner = agent({
  model: "typecheck",
  instructions: p`Find and classify TypeScript decorators across the codebase.

Scan for decorators:
${p.bash("grep -rn '@[A-Z][a-zA-Z]*' --include='*.ts' . 2>/dev/null | grep -v node_modules | grep -v '.git' | head -60")}

For each unique decorator found, use classifyDecorator with one representative context line.
Determine if any experimental decorators are used (e.g., @Inject, @Component, @NgModule).
Return decorators record (keyed by decorator name with count and type), totalCount, and hasExperimental.`,
  tools: [classifyDecorator],
  output: s.object({
    decorators: s.record(
      s.object({
        count: s.int,
        type: s.enum("class", "method", "property", "parameter"),
      }),
    ),
    totalCount: s.int,
    hasExperimental: s.boolean,
  }),
});

export default tsDecoratorScanner;
