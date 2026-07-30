import { agent, p, s, defineTool } from "rig";

const classifyDecorator = defineTool("classifyDecorator", {
  description: "Classify a TypeScript decorator by its name into a usage type.",
  parameters: s.object({ name: s.string }),
  handler({ name }) {
    const lower = name.toLowerCase();
    if (/^(component|module|injectable|controller|service|directive|pipe)$/.test(lower))
      return { type: "class" };
    if (/^(get|post|put|delete|patch|route|httpcode|header|body|query|param)$/.test(lower))
      return { type: "method" };
    if (/^(column|primarycolumn|primarygeneratedcolumn|onetomany|manytoone|manyto)/.test(lower))
      return { type: "property" };
    if (/^(param|body|query|request|response|headers|ip|session|uploadedfile)$/.test(lower))
      return { type: "parameter" };
    return { type: "unknown" };
  },
});

// Agent role: Scan TypeScript files for decorator usage and classify each decorator.
const tsDecoratorScanner = agent({
  model: "typecheck",
  instructions: p`Scan for TypeScript decorator patterns in the repository.

Decorator occurrences:
${p.bash("grep -rn '@[A-Z][A-Za-z]*' --include='*.ts' . 2>/dev/null | head -60 || echo 'none found'")}

For each unique decorator name found, call classifyDecorator to get its type.
Build a record keyed by decorator name (without @) with count and type.
Set hasExperimental to true if any decorators from experimental frameworks (e.g., legacy Angular, old NestJS) are found.
Return decorators record, totalCount (sum of all counts), and hasExperimental.`,
  tools: [classifyDecorator],
  output: s.object({
    decorators: s.record(
      s.object({
        count: s.int,
        type: s.enum("class", "method", "property", "parameter", "unknown"),
      })
    ),
    totalCount: s.int,
    hasExperimental: s.boolean,
  }),
});

export default tsDecoratorScanner;
