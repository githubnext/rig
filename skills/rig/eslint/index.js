import defineToolArgCount from "./rules/define-tool-arg-count.js";
import agentsMustBeObject from "./rules/agents-must-be-object.js";
import noObjectLiteralRecord from "./rules/no-object-literal-record.js";
import repairNoArgs from "./rules/repair-no-args.js";
import noImplicitAnyInToolHandler from "./rules/no-implicit-any-in-tool-handler.js";
import preferPGlobOverBashFind from "./rules/prefer-p-glob-over-bash-find.js";

export default {
  meta: {
    name: "rig",
  },
  rules: {
    "define-tool-arg-count": defineToolArgCount,
    "agents-must-be-object": agentsMustBeObject,
    "no-object-literal-record": noObjectLiteralRecord,
    "repair-no-args": repairNoArgs,
    "no-implicit-any-in-tool-handler": noImplicitAnyInToolHandler,
    "prefer-p-glob-over-bash-find": preferPGlobOverBashFind,
  },
};
