# 447 - XML Attribute Extractor

```rig
import { agent, p, s, defineTool } from "rig";
import { repair } from "rig";

const extractXmlAttributes = defineTool("extractXmlAttributes", {
  description: "Extract all elements and their attributes from XML/HTML content",
  parameters: s.object({ xmlContent: s.string }),
  handler: ({ xmlContent }: { xmlContent: string }) => {
    const elements: Record<string, { attrs: Record<string, string>; attrCount: number }> = {};
    let totalAttributes = 0;
    let totalElements = 0;
    const elementPattern = /<(\w+)([^>]*)>/g;
    const attrPattern = /(\w[\w-]*)=["']([^"']*)["']/g;
    let elemMatch: RegExpExecArray | null;
    while ((elemMatch = elementPattern.exec(xmlContent)) !== null) {
      const tagName = elemMatch[1];
      const attrsStr = elemMatch[2] ?? "";
      const attrs: Record<string, string> = {};
      let attrMatch: RegExpExecArray | null;
      const attrRe = new RegExp(attrPattern.source, "g");
      while ((attrMatch = attrRe.exec(attrsStr)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
        totalAttributes++;
      }
      const key = `${tagName}_${totalElements}`;
      elements[key] = { attrs, attrCount: Object.keys(attrs).length };
      totalElements++;
    }
    return { elements, totalAttributes, totalElements };
  },
});

// Agent role: Extract all XML element attributes from a given XML file.
const xmlAttributeExtractor = agent({
  model: "small",
  input: s.object({ xmlFile: s.string }),
  instructions: p`Read the XML file at the provided path: ${p.readInput("xmlFile")}.
Call extractXmlAttributes with the full file content.
Return all elements with their attributes, total attribute count, and element count.`,
  output: s.object({
    elements: s.record(s.object({
      attrs: s.record(s.string),
      attrCount: s.int,
    })),
    totalAttributes: s.int,
    totalElements: s.int,
  }),
  tools: [extractXmlAttributes],
  addons: [repair()],
});

export default xmlAttributeExtractor;
```
