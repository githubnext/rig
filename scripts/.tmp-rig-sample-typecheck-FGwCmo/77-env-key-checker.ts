import { agent, p, s, defineTool } from "rig";

const parseEnvKeys = defineTool("parseEnvKeys", {
  description: "Extract KEY names from dotenv-style file content",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const keys = (content.match(/^([A-Z_][A-Z0-9_]*)=/gm) || [])
      .map((line: string) => line.replace("=", ""));
    return { keys };
  },
});

// Agent role: compare .env.example required keys against .env actual keys to find missing and extra entries.
const envKeyChecker = agent({
  model: "typecheck",
  instructions: p`Read the required env keys from ${p.readOptional(".env.example")} and the present keys from ${p.readOptional(".env")}. Use the parseEnvKeys tool on each file content to extract key names. Compare to find missing keys (in example but not env) and extra keys (in env but not example).`,
  output: s.object({
    missing: s.array(s.string),
    extra: s.array(s.string),
    requiredCount: s.int,
    presentCount: s.int,
    status: s.enum("complete", "partial", "empty"),
  }),
  tools: [parseEnvKeys],
});

export default envKeyChecker;

