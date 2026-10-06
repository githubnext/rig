# 507 - HTML Form Field Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractFormFields = defineTool("extractFormFields", {
  description: "Extract HTML form fields from HTML content",
  parameters: s.object({ content: s.string }),
  handler: ({ content }: { content: string }) => {
    type FieldType = "text" | "email" | "password" | "checkbox" | "radio" | "select" | "textarea" | "other";
    const fields: Array<{ name?: string; type: FieldType; required: boolean; id?: string }> = [];
    const inputRe = /<input([^>]*)>/gi;
    const selectRe = /<select([^>]*)>/gi;
    const textareaRe = /<textarea([^>]*)>/gi;
    const getAttr = (attrs: string, attr: string): string | undefined => {
      const m = attrs.match(new RegExp(`${attr}\\s*=\\s*["']?([^"'\\s>]*)`, "i"));
      return m ? m[1] : undefined;
    };
    const classifyType = (t?: string): FieldType => {
      if (!t) return "text";
      const lower = t.toLowerCase();
      if (lower === "email") return "email";
      if (lower === "password") return "password";
      if (lower === "checkbox") return "checkbox";
      if (lower === "radio") return "radio";
      if (lower === "text") return "text";
      return "other";
    };
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(content)) !== null) {
      const attrs = m[1];
      const entry: { name?: string; type: FieldType; required: boolean; id?: string } = {
        type: classifyType(getAttr(attrs, "type")),
        required: /\brequired\b/i.test(attrs),
      };
      const name = getAttr(attrs, "name");
      if (name !== undefined) entry.name = name;
      const id = getAttr(attrs, "id");
      if (id !== undefined) entry.id = id;
      fields.push(entry);
    }
    while ((m = selectRe.exec(content)) !== null) {
      const attrs = m[1];
      const entry: { name?: string; type: FieldType; required: boolean; id?: string } = {
        type: "select" as const,
        required: /\brequired\b/i.test(attrs),
      };
      const name = getAttr(attrs, "name");
      if (name !== undefined) entry.name = name;
      const id = getAttr(attrs, "id");
      if (id !== undefined) entry.id = id;
      fields.push(entry);
    }
    while ((m = textareaRe.exec(content)) !== null) {
      const attrs = m[1];
      const entry: { name?: string; type: FieldType; required: boolean; id?: string } = {
        type: "textarea" as const,
        required: /\brequired\b/i.test(attrs),
      };
      const name = getAttr(attrs, "name");
      if (name !== undefined) entry.name = name;
      const id = getAttr(attrs, "id");
      if (id !== undefined) entry.id = id;
      fields.push(entry);
    }
    return fields;
  },
});

// Agent role: Extract and classify HTML form fields from a caller-supplied HTML file.
const htmlFormFieldExtractor = agent({
  model: "small",
  input: s.object({ htmlFile: s.string }),
  instructions: p`Extract form fields from the HTML file at input.htmlFile: ${p.readInput("htmlFile")}.
Call extractFormFields with the file content.
Return the declared output.`,
  output: s.object({
    fields: s.array(s.object({
      name: s.optional(s.string),
      type: s.enum("text", "email", "password", "checkbox", "radio", "select", "textarea", "other"),
      required: s.boolean,
      id: s.optional(s.string),
    })),
    totalFields: s.int,
    fieldTypeCounts: s.record(s.int),
  }),
  tools: [extractFormFields],
  addons: [repair()],
});

export default htmlFormFieldExtractor;
```
