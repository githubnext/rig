import agentsMustBeObject from "./rules/agents-must-be-object.js";
import noObjectLiteralRecord from "./rules/no-object-literal-record.js";
import noRigAddonsImport from "./rules/no-rig-addons-import.js";
import repairNoArgs from "./rules/repair-no-args.js";

export default {
  meta: {
    name: "rig",
  },
  rules: {
    "agents-must-be-object": agentsMustBeObject,
    "no-object-literal-record": noObjectLiteralRecord,
    "no-rig-addons-import": noRigAddonsImport,
    "repair-no-args": repairNoArgs,
  },
};
