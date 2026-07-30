import { agent, p, s } from "rig";

// Agent role: audit npm dependency licenses and flag copyleft packages.
const depLicenseAuditorV2 = agent({
  model: "typecheck",
  instructions: p`Audit the licenses of npm dependencies and classify each one.

Installed dependencies (JSON tree):
${p.bash("npm ls --json --depth=0 2>/dev/null || echo '{}'")}

Package dependency names:
${p.bash("node -e \"try{const p=require('./package.json');console.log(JSON.stringify(Object.keys(p.dependencies||{})))}catch(e){console.log('[]')}\"")}

Package license fields from node_modules:
${p.bash("node -e \"const fs=require('fs');const d='./node_modules';if(fs.existsSync(d)){const pkgs=fs.readdirSync(d).filter(x=>!x.startsWith('.'));pkgs.slice(0,30).forEach(p=>{try{const m=JSON.parse(fs.readFileSync(d+'/'+p+'/package.json','utf8'));console.log(p+':'+m.license)}catch(e){}});}\" 2>/dev/null || echo 'unavailable'")}

For each dependency, determine its license. Classify as:
- permissive: MIT, ISC, BSD, Apache, CC0, Unlicense, 0BSD
- copyleft: GPL, LGPL, AGPL, MPL, EUPL, CC-BY-SA
- unknown: anything else or unspecified

Return the packages array with name, license, and classification, hasCopyleft (true if any
copyleft found), and totalCount.`,
  output: s.object({
    packages: s.array(
      s.object({
        name: s.string,
        license: s.string,
        classification: s.enum("permissive", "copyleft", "unknown"),
      })
    ),
    hasCopyleft: s.boolean,
    totalCount: s.int,
  }),
});

export default depLicenseAuditorV2;
