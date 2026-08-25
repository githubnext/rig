# 470 - Package JSON Field Auditor

```rig
import { agent, defineTool, p, repair, s } from "rig";


const checkFieldPresence = defineTool("checkFieldPresence", {
  description: "Check which standard package.json fields are present and non-empty.",
  parameters: s.object({ content: s.string("Raw package.json content") }),
  handler({ content }) {
    let pkg: Record<string, unknown>;
    try { pkg = JSON.parse(content); } catch { return JSON.stringify({ error: "invalid json" }); }
    const standard = ["name", "version", "description", "main", "types", "scripts", "dependencies", "devDependencies", "peerDependencies", "license", "author", "repository", "keywords", "files", "engines"];
    const present: string[] = [];
    const missing: string[] = [];
    for (const f of standard) {
      const v = pkg[f];
      if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)) {
        present.push(f);
      } else {
        missing.push(f);
      }
    }
    const score = Math.round((present.length / standard.length) * 100);
    return JSON.stringify({ present, missing, score });
  },
});

// Agent role: audit package.json for presence of standard fields and compute a completeness score.
const packageJsonFieldAuditor = agent({
  name: "packageJsonFieldAuditor",
  model: "small",
  instructions: p`Audit the project's package.json for standard field completeness.
${p.read("package.json")}
Use checkFieldPresence with the full file content. Return present/missing fields, completenessScore (0–100), and a recommendation.`,
  output: s.object({
    presentFields: s.array(s.string),
    missingFields: s.array(s.string),
    completenessScore: s.int,
    recommendation: s.string,
  }),
  tools: [checkFieldPresence],
  addons: [repair()],
});

export default packageJsonFieldAuditor;
```
