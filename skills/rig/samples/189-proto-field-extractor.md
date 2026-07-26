# 189 - Proto Field Extractor

```rig
import { agent, defineTool, p, s } from "rig";

const extractProtoMessages = defineTool("extractProtoMessages", {
  description: "Read a .proto file and extract message names with their field definitions",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const result: Record<string, Array<{ fieldName: string; fieldType: string; fieldNumber: number; isRepeated: boolean }>> = {};
      const messageRegex = /message\s+(\w+)\s*\{([^}]*)\}/gs;
      const fieldRegex = /^\s*(repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)/gm;
      let msgMatch;
      while ((msgMatch = messageRegex.exec(content)) !== null) {
        const [, messageName, body] = msgMatch;
        const fields: Array<{ fieldName: string; fieldType: string; fieldNumber: number; isRepeated: boolean }> = [];
        let fieldMatch;
        fieldRegex.lastIndex = 0;
        while ((fieldMatch = fieldRegex.exec(body)) !== null) {
          const [, repeated, fieldType, fieldName, fieldNumberStr] = fieldMatch;
          fields.push({
            fieldName,
            fieldType,
            fieldNumber: parseInt(fieldNumberStr, 10),
            isRepeated: !!repeated,
          });
        }
        result[messageName] = fields;
      }
      return result;
    } catch (e) {
      return { error: String(e) };
    }
  },
});

// Agent role: find .proto files and extract message field definitions from each.
const protoFieldExtractor = agent({
  model: "small",
  tools: [extractProtoMessages],
  instructions: p`Find .proto files: ${p.bash("find . -name '*.proto' -not -path '*/node_modules/*' 2>/dev/null | head -20 || echo ''")}. For each .proto file found, call extractProtoMessages to parse message definitions and field lists. Merge all results into a record keyed by message name. If no .proto files exist, return an empty record.`,
  output: s.record(s.array(s.object({
    fieldName: s.string,
    fieldType: s.string,
    fieldNumber: s.int,
    isRepeated: s.boolean,
  }))),
});

export default protoFieldExtractor;
```
