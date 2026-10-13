# 542 - Shift Schedule Localizer

```rig
import { agent, p, s } from "rig";

// Agent role: translate each worker's assigned shift into a human-readable
// label for every supported locale, keeping the roster rows identical across
// locales while varying only the shift label text.
const localizer = agent({
  model: "large",
  instructions: p`Here is the factory shift roster (worker, shift code, station):

1. Alice Nguyen, MORNING, Station A
2. Ben Osei, MORNING, Station B
3. Carla Ruiz, AFTERNOON, Station A
4. Dmitri Volkov, AFTERNOON, Station C
5. Emeka Obi, NIGHT, Station B
6. Fatima Al-Sayed, NIGHT, Station C
7. Grace Lin, MORNING, Station C
8. Hassan Malik, AFTERNOON, Station B

Shift codes map to these English names: MORNING -> "Morning Shift",
AFTERNOON -> "Afternoon Shift", NIGHT -> "Night Shift".

Return a record keyed by exactly the four locale codes 'en', 'es', 'fr', 'de'.
Each locale's value must be an array with one entry per worker above, in the
same order, containing that worker's name and the shift name translated into
that locale (e.g. "Night Shift" in French is "Équipe de nuit"). Do not drop,
reorder, or partition workers across locales: every locale array must list all
8 workers, differing only in the translated shiftLabel text.`,
  output: s.record(
    s.array(
      s.object({
        worker: s.string,
        shiftLabel: s.string,
      }),
    ),
  ),
});

export default localizer;
```
