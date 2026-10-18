# 551 - Nested Catalog Partial Rollup

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: recursively roll up completion stats from a nested catalog, counting
// only "observed" lessons; subtrees with none observed stay out of the
// denominator (missing data) instead of counting as zero progress.
const rollupCatalog = defineTool("rollup_catalog", {
  description: "Recursively compute per-program completion percentages from a nested catalog, using only observed lessons.",
  parameters: s.object({ catalogJson: s.string }),
  handler: ({ catalogJson }: { catalogJson: string }) => {
    type Lesson = { observed: boolean; completed: boolean };
    type Node = { lessons?: Lesson[]; submodules?: Record<string, Node> };
    const catalog: Record<string, { modules: Record<string, Node> }> = JSON.parse(catalogJson);
    const result: Record<string, { completionPct: number; incompleteModules: string[] }> = {};
    const walk = (path: string, node: Node, miss: string[]): { obs: number; done: number } => {
      const own = (node.lessons ?? []).filter((l: Lesson) => l.observed);
      let obs = own.length, done = own.filter((l: Lesson) => l.completed).length;
      for (const [name, child] of Object.entries(node.submodules ?? {})) {
        const st = walk(`${path}/${name}`, child, miss);
        obs += st.obs; done += st.done;
      }
      if (obs === 0) miss.push(path);
      return { obs, done };
    };
    for (const [prog, data] of Object.entries(catalog)) {
      const miss: string[] = [];
      let obs = 0, done = 0;
      for (const [name, mod] of Object.entries(data.modules)) {
        const st = walk(name, mod, miss);
        obs += st.obs; done += st.done;
      }
      result[prog] = { completionPct: obs > 0 ? Math.round((done / obs) * 1000) / 10 : 0, incompleteModules: miss };
    }
    return { result };
  },
});

// Agent role: read an embedded nested course catalog (programs > modules >
// submodules > lessons, arbitrary depth) and compute per-program completion
// from only observed lessons, leaving unobserved branches out of the math.
const nestedCatalogPartialRollup = agent({
  model: "small",
  tools: [rollupCatalog],
  instructions: p`Nested language-learning course catalog as JSON (a module's
    "lessons" each have an "observed" flag meaning a learner attempted it,
    and a "completed" flag; modules may nest "submodules" to any depth):
    ${p.bash(`cat <<'EOF'
{"Spanish Fluency":{"modules":{"Foundations":{"lessons":[{"name":"Greetings","observed":true,"completed":true},{"name":"Numbers","observed":true,"completed":false},{"name":"Colors","observed":false,"completed":false}],"submodules":{"Pronunciation":{"lessons":[{"name":"Vowels","observed":true,"completed":true}]}}},"Conversation":{"lessons":[{"name":"Ordering Food","observed":false,"completed":false}],"submodules":{"Travel Phrases":{"lessons":[{"name":"Directions","observed":false,"completed":false}]}}}}},"Japanese for Travel":{"modules":{"Scripts":{"lessons":[{"name":"Hiragana","observed":true,"completed":true},{"name":"Katakana","observed":true,"completed":true}],"submodules":{"Kanji Basics":{"lessons":[{"name":"Radicals","observed":true,"completed":false}],"submodules":{"Stroke Order":{"lessons":[{"name":"Numbers Kanji","observed":false,"completed":false}]}}}}},"Etiquette":{"lessons":[{"name":"Bowing","observed":false,"completed":false}]}}}}
EOF`)}

    Call rollup_catalog once with this entire JSON object serialized exactly
    as shown (as the catalogJson string argument), then return its "result"
    field directly as your output.`,
  output: s.record(
    s.object({
      completionPct: s.number,
      incompleteModules: s.array(s.string),
    }),
  ),
});

export default nestedCatalogPartialRollup;
```
