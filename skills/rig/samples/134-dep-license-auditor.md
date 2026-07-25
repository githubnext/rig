# 134 - Dep License Auditor

```rig
import { agent, p, s, defineTool } from "rig";

const classifyLicense = defineTool("classifyLicense", {
  description: "Classify a license identifier as permissive, copyleft, or unknown",
  parameters: s.object({ license: s.string }),
  handler: ({ license }) => {
    const l = license.toLowerCase();
    const permissive = ["mit", "isc", "apache", "bsd", "0bsd", "unlicense", "cc0", "wtfpl", "zlib"];
    const copyleft = ["gpl", "lgpl", "agpl", "mpl", "eupl", "cddl"];
    if (permissive.some((p) => l.includes(p))) return "permissive";
    if (copyleft.some((c) => l.includes(c))) return "copyleft";
    return "unknown";
  },
});

// Agent role: audit npm dependency licenses and flag copyleft or unknown packages.
const depLicenseAuditor = agent({
  model: "small",
  instructions: p`Audit the licenses of all direct npm dependencies.

Direct dependencies: ${p.bash("npm ls --json --depth=0 2>/dev/null | head -300")}

License fields from node_modules: ${p.bash("node -e \"const fs=require('fs'); const d='./node_modules'; if(fs.existsSync(d)) { fs.readdirSync(d).filter(n=>!n.startsWith('.')).slice(0,60).forEach(n=>{ try{const p=JSON.parse(fs.readFileSync(d+'/'+n+'/package.json','utf8')); console.log(n+'|'+(p.license||'NONE'))}catch(e){} }) }\" 2>/dev/null")}

For each direct dependency, use classifyLicense to classify its license. Set hasCopyleft to true if any package has classification copyleft.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      license: s.string,
      classification: s.enum("permissive", "copyleft", "unknown"),
    })),
    hasCopyleft: s.boolean,
  }),
  tools: [classifyLicense],
});

export default depLicenseAuditor;
```
