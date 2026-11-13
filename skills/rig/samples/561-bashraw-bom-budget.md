# 561 - Bashraw Bom Budget

```rig
import { agent, p, s } from "rig";

// Agent role: audit a synthetic nested bill of materials against per-assembly cost budgets.
const bomBudgetAuditor = agent({
  model: "small",
  maxTurns: 3,
  instructions: p`Synthetic BOM lines are id|part|qty|unit_cost|budget. Ids use dotted nesting such as ASM-1.2.3. The awk step uses a regex with literal backslashes to keep only valid ids and total cost per top-level assembly:
${p.bashRaw`printf 'ASM-1|frame|2|10.00|100\nASM-1.1|bolt|40|0.25|100\nASM-1.2.1|gear|3|22.50|100\nASM-2|panel|4|8.00|60\nASM-2.1|clip|20|1.10|60\nbad id|junk|1|1|1\nASM-3|motor|1|45.00|50\nASM-3.1.2|wire|9|0.80|50\n' | awk -F'|' '$1 ~ /^[A-Z]+\\-[0-9]+(\\.[0-9]+)*$/ { split($1, a, "."); t[a[1]] += $3 * $4; b[a[1]] = $5; l[a[1]] = l[a[1]] " " $1 } END { for (k in t) printf "%s total=%.2f budget=%s lines:%s\n", k, t[k], b[k], l[k] }' | sort`}
Return one entry per top-level assembly. Set overBudget true when total exceeds budget, and list its line ids as nested components.`,
  output: s.object({
    assemblies: s.array(s.object({
      assembly: s.nonEmptyString,
      total: s.number,
      budget: s.number,
      overBudget: s.boolean,
      components: s.array(s.object({ id: s.nonEmptyString, depth: s.int })),
    })),
    overBudgetCount: s.int,
    summary: s.string,
  }),
});

export default bomBudgetAuditor;
```
