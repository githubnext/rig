# 558 - Nested Catalog Budget Allocator

```rig
import { agent, p, s } from "rig";

// Agent role: allocate a fixed 40-hour volunteer-hour budget top-down across each festival's stages.
const nestedCatalogBudgetAllocator = agent({
  model: "large",
  instructions: p`Read this nested community-event catalog, three levels deep (festival -> stages -> time-slotted acts):
${p.bash("printf '%s\\n' \"FESTIVAL: Riverside Summer Festival\" \"STAGE: Main Stage\" \"  ACT 14:00 The Tideline Trio\" \"  ACT 15:30 Harbor Brass Band\" \"  ACT 17:00 Coastal Echoes\" \"  ACT 18:30 The Driftwood Four\" \"  ACT 20:00 Riverside Allstars\" \"STAGE: Acoustic Tent\" \"  ACT 13:00 Willow and Cane\" \"  ACT 14:30 Maren Holt\" \"  ACT 16:00 The Quiet Oars\" \"STAGE: Food Court Stage\" \"  ACT 12:00 Lunchtime Strummers\" \"  ACT 13:30 The Market Buskers\" \"FESTIVAL: Night Market Busking Festival\" \"STAGE: Lantern Corner\" \"  ACT 18:00 Paper Lantern Duo\" \"STAGE: Spice Alley Corner\" \"  ACT 18:15 Cinnamon Street Trio\" \"STAGE: Harbor View Corner\" \"  ACT 18:30 Tidewatch Singer\" \"STAGE: Old Town Corner\" \"  ACT 18:45 Cobblestone Fiddler\" \"STAGE: Clocktower Corner\" \"  ACT 19:00 Chime Hour Quartet\" \"STAGE: Market Square Corner\" \"  ACT 19:15 Square Dance Combo\" \"STAGE: Riverside Walk Corner\" \"  ACT 19:30 Walkway Whistler\"")}

Each festival has a fixed total volunteer-hour budget of 40 hours, allocated top-down and independently per festival. For each festival:
1. List its stages in the fixed order they appear in the catalog.
2. Compute every stage's proportional share of the 40-hour budget based on its act count among ALL of that festival's stages (not just remaining ones), rounded to the nearest whole hour.
3. Walk the stages in listed order, adding each stage's computed share to a running total. Allocate a stage only while the running total after adding its share would not exceed 40 hours.
4. The instant a stage's share would push the running total over 40 hours, mark that stage and every remaining stage after it (in listed order) as unfunded, regardless of their individual act-count entitlement. Do not allocate any hours to them.

Return, per festival, the map of stage name to allocated hours for funded stages only (stageAllocations), and the ordered list of stage names that were cut off (unfundedStages).`,
  output: s.record(s.object({
    stageAllocations: s.record(s.number),
    unfundedStages: s.array(s.string),
  })),
});

export default nestedCatalogBudgetAllocator;
```
