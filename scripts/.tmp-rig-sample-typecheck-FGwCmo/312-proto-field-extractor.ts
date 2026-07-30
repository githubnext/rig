import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: extract field definitions from protobuf message types in .proto files.
const protoFieldExtractor = agent({
  model: "typecheck",
  instructions: p`You are a protobuf field extractor.

Find .proto files in the workspace:
${p.bash("find . -name '*.proto' -not -path '*/node_modules/*' 2>/dev/null || echo 'no .proto files found'")}

For each .proto file found, call extractProtoFields with its path to parse message definitions.
Return the declared output keyed by message name.`,
  tools: [
    defineTool("extractProtoFields", {
      description: "Read a .proto file and extract message field definitions",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const result: Record<string, Array<{ fieldName: string; fieldType: string; fieldNumber: number; isRepeated: boolean }>> = {};
        const messageRegex = /message\s+(\w+)\s*\{([^}]*)\}/gs;
        const fieldRegex = /^\s*(repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)/gm;
        for (const msgMatch of content.matchAll(messageRegex)) {
          const messageName = msgMatch[1];
          const body = msgMatch[2];
          const fields: Array<{ fieldName: string; fieldType: string; fieldNumber: number; isRepeated: boolean }> = [];
          for (const fldMatch of body.matchAll(fieldRegex)) {
            fields.push({
              isRepeated: !!fldMatch[1],
              fieldType: fldMatch[2],
              fieldName: fldMatch[3],
              fieldNumber: parseInt(fldMatch[4], 10),
            });
          }
          result[messageName] = fields;
        }
        return result;
      },
    }),
  ],
  output: s.record(s.array(s.object({
    fieldName: s.string,
    fieldType: s.string,
    fieldNumber: s.int,
    isRepeated: s.boolean,
  }))),
  addons: [repair()],
});

export default protoFieldExtractor;
