import { agent, p, s, defineTool, repair } from "rig";

const parseEnvKeys = defineTool("parseEnvKeys", {
  description: "Parse an env file string and return the list of key names.",
  parameters: { content: s.string },
  handler: ({ content }) => {
    return content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith("#"))
      .map((line: string) => line.split("=")[0].trim())
      .filter(Boolean);
  },
});

// Agent role: compare .env.example with .env to check completeness of environment configuration.
const envFileCompletenessChecker = agent({
  model: "typecheck",
  instructions: p`Compare .env.example with .env to check that all required keys are set.

.env.example content: ${p.readOptional(".env.example")}

.env content: ${p.readOptional(".env")}

Steps:
1. Call parseEnvKeys with the .env.example content to get exampleKeys.
2. Call parseEnvKeys with the .env content to get presentKeys.
3. Compute missingKeys (in exampleKeys but not presentKeys) and extraKeys (in presentKeys but not exampleKeys).
4. Compute completeness as (exampleKeys.length - missingKeys.length) / exampleKeys.length (or 1.0 if example is empty).
5. Set status:
   - "missing-example" if .env.example is empty/missing
   - "missing-env" if .env is empty/missing
   - "complete" if missingKeys is empty
   - "partial" otherwise`,
  output: s.object({
    exampleKeys: s.array(s.string),
    presentKeys: s.array(s.string),
    missingKeys: s.array(s.string),
    extraKeys: s.array(s.string),
    completeness: s.number,
    status: s.enum("complete", "partial", "missing-example", "missing-env"),
  }),
  tools: [parseEnvKeys],
  addons: [repair()],
});

export default envFileCompletenessChecker;
