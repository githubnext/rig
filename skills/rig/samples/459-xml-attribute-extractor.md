# 459 - XML Attribute Extractor

```rig
import { agent, p, s, defineTool } from "rig";

const parseXmlAttributes = defineTool("parseXmlAttributes", {
  description: "Extract element names and their attribute names from XML content",
  parameters: s.object({ xmlContent: s.string }),
  handler: ({ xmlContent }: { xmlContent: string }) => {
    const openTagPattern = /<([A-Za-z][A-Za-z0-9_:-]*)([^>]*?)(?:\/?>)/g;
    const elements: Record<string, string[]> = {};
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = openTagPattern.exec(xmlContent)) !== null) {
      const tagName = tagMatch[1];
      const attrStr = tagMatch[2] ?? "";
      const attrs: string[] = [];
      const ap = /([A-Za-z][A-Za-z0-9_:-]*)=/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = ap.exec(attrStr)) !== null) {
        attrs.push(attrMatch[1]);
      }
      if (!elements[tagName]) elements[tagName] = [];
      attrs.forEach((a: string) => {
        if (!elements[tagName].includes(a)) elements[tagName].push(a);
      });
    }
    const uniqueElements = Object.keys(elements).length;
    const uniqueAttributes = new Set(Object.values(elements).flat()).size;
    return { elements, uniqueElements, uniqueAttributes };
  },
});

// Agent role: Extract all XML element names and their attribute names from the given XML file.
const xmlAttributeExtractor = agent({
  model: "small",
  input: s.object({ xmlFile: s.string }),
  instructions: p`Parse the XML file content: ${p.readInput("xmlFile")}. Call parseXmlAttributes with the full XML content. Return the extracted structure.`,
  output: s.object({
    elements: s.record(s.array(s.string)),
    uniqueElements: s.int,
    uniqueAttributes: s.int,
  }),
  tools: [parseXmlAttributes],
});

export default xmlAttributeExtractor;

```
