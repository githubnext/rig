# 553 - Linked Record Chain Budget Walk

```rig
import { s, workflow } from "rig";

const record = s.object({
  id: s.string,
  kind: s.string,
  cost: s.number,
  nextId: s.nullable(s.string),
});

const CHAIN_DATA =
  "flight-001: kind=flight, cost=320, nextId=hotel-002 | "
  + "hotel-002: kind=hotel, cost=410, nextId=transfer-003 | "
  + "transfer-003: kind=local-transfer, cost=85, nextId=excursion-004 | "
  + "excursion-004: kind=excursion, cost=150, nextId=transfer-005 | "
  + "transfer-005: kind=local-transfer, cost=60, nextId=null";

const BUDGET = 900;

// Workflow role: walk a linked chain of travel records one id at a time, then
// enforce a fixed dollar budget over the resolved chain and report the cut point.
const linkedRecordChainBudgetWalk = workflow({
  meta: {
    name: "linked-record-chain-budget-walk",
    description: "Resolve a linked travel-record chain, then trim it to a fixed budget",
    phases: [{ title: "Resolve" }, { title: "Budget" }],
    whenToUse: "Walking cross-referencing records while enforcing a cumulative cost cap.",
  },
  body: async ({ call, phase }) => {
    phase("Resolve");
    const resolved: { id: string; kind: string; cost: number }[] = [];
    let currentId: string | null = "flight-001";

    while (currentId) {
      const step: { id: string; kind: string; cost: number; nextId: string | null } | null = await call.json(
        `Travel record chain data: ${CHAIN_DATA}\nLook up the record whose id is "${currentId}" and return its id, kind, cost, and nextId (or null if it is the last record).`,
        record,
        { label: currentId },
      );
      if (!step) break;
      resolved.push({ id: step.id, kind: step.kind, cost: step.cost });
      currentId = step.nextId;
    }

    phase("Budget");
    const itinerary: { id: string; kind: string; cost: number }[] = [];
    let totalCost = 0;
    let cutAtId: string | null = null;

    for (const item of resolved) {
      if (totalCost + item.cost > BUDGET) {
        cutAtId = item.id;
        break;
      }
      itinerary.push(item);
      totalCost += item.cost;
    }

    return { itinerary, totalCost, cutAtId };
  },
});

export default linkedRecordChainBudgetWalk;
```
