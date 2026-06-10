import { agent, s } from "rig";

const root = agent({
  name: "launcher-stdin-json-root",
  input: s.object({ message: s.string }),
  output: s.object({ ok: s.boolean }),
});

export default root;
