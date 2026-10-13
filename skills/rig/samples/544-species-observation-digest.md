# 544 - Species Observation Digest

```rig
import { agent, p, s } from "rig";

// Agent role: parse a synthetic field-survey log, write a species digest
// report, and summarize the most common local name per species.
const speciesObservationDigest = agent({
  model: "small",
  instructions: p`Read the field-survey log below, produced by
    ${p.bash(`printf '%s\\n' \
      "english,local_fr,local_sw" \
      "Grey Heron,Heron cendre,Korongo" \
      "African Fish Eagle,Pygargue vocifere,Furukombe" \
      "Grey Heron,Heron cendre,Nyange" \
      "Lesser Flamingo,Flamant nain,Heroe mdogo" \
      "African Fish Eagle,Pygargue vocifere,Furukombe" \
      "Grey Heron,Aigrette grise,Korongo" \
      "Lesser Flamingo,Flamant nain,Heroe mdogo" \
      "African Fish Eagle,Pygargue vocifere,Tai" \
      "Grey Heron,Heron cendre,Korongo" \
      "Lesser Flamingo,Flamant rose nain,Heroe mdogo" \
      "African Fish Eagle,Aigle pecheur,Furukombe" \
      "Grey Heron,Heron cendre,Korongo"`)}

    Each data row (after the header) lists: english common name, a French
    local label, and a Swahili local label for one observation. Group rows by
    the canonical English species name. For each species, count total
    observations and tally how often each distinct local-language label
    (French or Swahili column value) appears across its observations.

    Compose a markdown digest with a heading, a table of species and their
    observation counts, and for each species a short line noting its most
    frequently used local label. Then write that digest via
    ${p.write("species-digest-report.md", "# Species Observation Digest\n")}.

    Return reportPath ("species-digest-report.md"), speciesCount (the number
    of distinct species), and mostCommonLocalName: a record mapping each
    canonical English species name to the single local-language label (French
    or Swahili) that occurred most often among that species' observations,
    breaking ties by picking the label that appears first in the log.`,
  output: s.object({
    reportPath: s.path,
    speciesCount: s.int,
    mostCommonLocalName: s.record(s.string),
  }),
});

export default speciesObservationDigest;
```
