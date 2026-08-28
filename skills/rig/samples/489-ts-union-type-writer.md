# 489 - TS Union Type Writer

```rig
import { agent, defineTool, p, repair, s } from "rig";

const validateVariant = defineTool("validateVariant", {
  description: "Check whether a string is a valid TypeScript identifier.",
  parameters: s.object({ variant: s.string }),
  handler: async ({ variant }) => {
    const valid = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(variant);
    return { variant, valid };
  },
});

// Agent role: generate a TypeScript union type declaration from caller-supplied variants and write it to a file.
const tsUnionTypeWriter = agent({
  model: "small",
  input: s.object({
    typeName: s.string,
    variants: s.array(s.string),
    outputFile: s.path,
  }),
  instructions: p`You are given a typeName, variants array, and outputFile path via input. For each variant in input.variants, call validateVariant to check it is a valid TypeScript identifier. Build a TypeScript union type declaration: "export type <typeName> = <variant1> | <variant2> | ...;" using only valid variants. Write the declaration to input.outputFile using ${p.writeInput("outputFile", "typeSource")}. Return outputFile, variantsWritten (valid variants), isValid (true if all variants passed), linesEmitted (line count of the declaration).`,
  output: s.object({
    typeSource: s.string,
    outputFile: s.path,
    variantsWritten: s.array(s.string),
    isValid: s.boolean,
    linesEmitted: s.int,
  }),
  tools: [validateVariant],
  maxTurns: 6,
  addons: [repair()],
});

export default tsUnionTypeWriter;
```
