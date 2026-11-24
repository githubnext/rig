# 568 - Three Way Event Budget Arbitrator

```rig
import { agent, p, s } from "rig";

// Agent role: count acts in a nested community-event catalog and preserve auditable counts.
const nestedActCounter = agent({
  name: "nestedActCounter",
  model: "mini",
  input: s.object({ catalog: s.string }),
  output: s.object({ eventCounts: s.record(s.int), stageCounts: s.record(s.int), totalActs: s.int, evidence: s.array(s.string) }),
  instructions: "Count every ACT under its EVENT and STAGE. Key stageCounts as 'Event / Stage', include eventCounts, totalActs, and concise counting evidence.",
});

// Agent role: allocate bounded volunteer-hour units from act counts.
const boundedBudgetAllocator = agent({
  name: "boundedBudgetAllocator",
  model: "small",
  input: s.object({ catalog: s.string, totalBudget: s.int, stageCounts: s.record(s.int) }),
  output: s.object({ allocation: s.record(s.int), totalAllocated: s.int, evidence: s.array(s.string) }),
  instructions: "Using only the supplied catalog and stageCounts, allocate nonnegative integer volunteer-hour units proportionally to act counts without exceeding totalBudget. Explain rounding and tie breaks in evidence.",
});

// Agent role: independently audit proportional fairness and produce a competing allocation.
const fairnessAuditor = agent({
  name: "fairnessAuditor",
  model: "small",
  input: s.object({ catalog: s.string, totalBudget: s.int, stageCounts: s.record(s.int) }),
  output: s.object({ recommendedAllocation: s.record(s.int), totalRecommended: s.int, verdict: s.enum("fair", "needs_revision", "inconclusive"), concerns: s.array(s.string), evidence: s.array(s.string) }),
  instructions: "Independently recompute a fairness-aware allocation from the catalog and stageCounts. Audit equal-count treatment, proportionality, and budget bounds; do not assume another plan exists. Return your own recommendation, verdict, concerns, and evidence.",
});

// Agent role: arbitrate three independent reports into a bounded, evidence-preserving allocation.
const threeWayEventBudgetArbitrator = agent({
  name: "threeWayEventBudgetArbitrator",
  model: "large",
  agents: { nestedActCounter, boundedBudgetAllocator, fairnessAuditor },
  instructions: p`Use this exact nested catalog and a total volunteer-hour budget of 12:
${p.bash("printf '%s\\n' 'EVENT: River Lantern Fair' ' STAGE: Main Lawn' '  ACT: Story Circle' '  ACT: Harbor Choir' '  ACT: Lantern Workshop' ' STAGE: Riverwalk' '  ACT: Folk Duo' '  ACT: Youth Drummers' 'EVENT: Neighborhood Harvest Day' ' STAGE: Orchard Tent' '  ACT: Seed Swap' '  ACT: Cider Songs' '  ACT: Local History' ' STAGE: Market Square' '  ACT: Basket Weavers' '  ACT: Community Kitchen' '  ACT: Repair Cafe'")}
Call nestedActCounter with that catalog, then pass its stageCounts plus the same catalog and budget to boundedBudgetAllocator and fairnessAuditor independently. Compare all reports, verify counts, identify disagreements, and arbitrate using recount evidence, proportionality, equal treatment, and the hard budget bound. Return each full specialist result as its corresponding evidence field, document every disagreement and resolution, and choose a nonnegative integer finalAllocation whose keys are validated stages and whose sum is at most 12.`,
  output: s.object({
    counterEvidence: s.object({ eventCounts: s.record(s.int), stageCounts: s.record(s.int), totalActs: s.int, evidence: s.array(s.string) }),
    allocatorEvidence: s.object({ allocation: s.record(s.int), totalAllocated: s.int, evidence: s.array(s.string) }),
    fairnessEvidence: s.object({ recommendedAllocation: s.record(s.int), totalRecommended: s.int, verdict: s.enum("fair", "needs_revision", "inconclusive"), concerns: s.array(s.string), evidence: s.array(s.string) }),
    disagreements: s.array(s.string),
    resolution: s.string,
    finalAllocation: s.record(s.int),
    totalAllocated: s.int,
  }),
});

export default threeWayEventBudgetArbitrator;
```
