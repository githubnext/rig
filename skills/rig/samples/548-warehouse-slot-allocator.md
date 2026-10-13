# 548 - Warehouse Slot Allocator

```rig
import { agent, p, s } from "rig";

const SLOTS = "Slot A1: items [widgetA x30, widgetB x12], count 42, capacity 40 | "
  + "Slot A2: items [widgetC x18], count 18, capacity 40 | "
  + "Slot B1: items [widgetD x40, widgetE x15], count 55, capacity 50 | "
  + "Slot B2: items [widgetF x20], count 20, capacity 50 | "
  + "Slot C1: items [widgetG x12], count 12, capacity 30";

// Agent role: flag warehouse slots whose current item count exceeds fixed capacity.
const capacityChecker = agent({
  model: "mini",
  instructions: p`Given this fixed slot capacity budget: ${SLOTS}\nFlag every slot whose current item count exceeds its fixed capacity.`,
  output: s.object({ overCapacitySlots: s.array(s.string) }),
});

// Agent role: propose item moves from over-capacity slots into under-capacity slots without exceeding any slot's fixed capacity.
const allocationRebalancer = agent({
  model: "mini",
  instructions: p`Given this fixed slot capacity budget: ${SLOTS}\nPropose specific item moves from over-capacity slots to under-capacity slots so that no destination slot exceeds its fixed capacity.`,
  output: s.array(s.object({ item: s.string, fromSlot: s.string, toSlot: s.string })),
});

// Agent role: coordinate the capacity checker and rebalancer against the shared slot budget and merge their results into a remediation plan.
const warehouseSlotAllocator = agent({
  model: "mini",
  instructions: p`Consult the capacityChecker subagent to find which slots exceed their fixed capacity in: ${SLOTS}\nThen consult the allocationRebalancer subagent to get proposed item moves that respect the same fixed capacity budget. Merge both results into a single allocation report.`,
  output: s.object({
    allocationReport: s.string,
    slotsOverBudget: s.array(s.string),
    movesProposed: s.array(s.object({ item: s.string, fromSlot: s.string, toSlot: s.string })),
  }),
  agents: { capacityChecker, allocationRebalancer },
});

export default warehouseSlotAllocator;
```
