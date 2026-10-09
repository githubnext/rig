# 523 - Repair Addon Demo

```rig
import { agent, repair, s } from "rig";

// Agent role: extract structured contact info from free-form text, with repair retries on malformed output.
const contactExtractor = agent({
  model: "small",
  maxTurns: 5,
  addons: repair(),
  instructions:
    "Extract the person's contact details from this text: \"Reach out to Dana Lee at dana.lee@example.com, she is 34 years old.\" Return exactly one name, one age, and one email, with no extra commentary.",
  output: s.object({
    name: s.string,
    age: s.number,
    email: s.string,
  }),
});

export default contactExtractor;
```
