import noObjectLiteralRecord from "./rules/no-object-literal-record.js";
import repairNoArgs from "./rules/repair-no-args.js";

export default {
  meta: {
    name: "rig",
  },
  rules: {
    "no-object-literal-record": noObjectLiteralRecord,
    "repair-no-args": repairNoArgs,
  },
};
