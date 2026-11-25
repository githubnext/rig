# 570 - Language Catalog Labels

```rig
import { agent, p, s } from "rig";

const unit = s.object({
  title: s.string,
  labels: s.nonEmptyObject(s.string),
  lessonTitles: s.record(s.string),
});
const course = s.object({
  title: s.string,
  units: s.nonEmptyObject(unit),
});
const manifest = s.object({
  courses: s.nonEmptyObject(course),
});

// Agent role: assemble a nested language-course catalog with required labels and partial locales.
const languageCatalogLabels = agent({
  model: "small",
  instructions: p`Use this synthetic local seed: ${p.bash("printf language-course-seed")}.
    Return one catalog containing the course "Lingua Paths" and at least one
    slash-delimited unit path. Every unit must retain a non-empty labels map
    with only the supplied locale translations; do not fill missing locales.
    Include representative multilingual labels (en plus es or fr) and keep
    lessonTitles as a string-keyed record. Preserve the seed's partial locale
    coverage while returning exactly the declared manifest shape.`,
  output: manifest,
});

export default languageCatalogLabels;
```
