import { agent, defineTool, p, s, repair } from "rig";

// Agent role: detect drift in workspace config files against a baseline.
const workspaceConfigDrift = agent({
  model: "typecheck",
  maxTurns: 6,
  addons: repair(),
  input: s.object({
    baselineFile: s.path,
  }),
  instructions: p`Read the baseline config from ${p.readInput("baselineFile")}.
Compare it against the current workspace configs:
- tsconfig.json: ${p.readOptional("tsconfig.json", "{}")}
- .eslintrc.json: ${p.readOptional(".eslintrc.json", "{}")}
- .prettierrc: ${p.readOptional(".prettierrc", "{}")}

Use the parseJson tool to parse each config. For each file, identify fields that differ from
the baseline. Return only the declared output.`,
  tools: [
    defineTool("parseJson", {
      description: "Parse a JSON string and return the keys",
      parameters: s.object({ content: s.string }),
      handler({ content }) {
        try {
          return Object.keys(JSON.parse(content));
        } catch {
          return [];
        }
      },
    }),
  ],
  output: s.object({
    results: s.record(
      s.object({
        driftedFields: s.array(s.string),
        status: s.enum("ok", "warning", "error"),
      })
    ),
    overallStatus: s.enum("ok", "warning", "error"),
  }),
});

export default workspaceConfigDrift;
