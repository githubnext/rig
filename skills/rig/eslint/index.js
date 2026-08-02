import defineToolArgCount from "./rules/define-tool-arg-count.js";
import agentsMustBeObject from "./rules/agents-must-be-object.js";
import noObjectLiteralRecord from "./rules/no-object-literal-record.js";
import repairNoArgs from "./rules/repair-no-args.js";
import addonOrder from "./rules/addon-order.js";
import noImplicitAnyInToolHandler from "./rules/no-implicit-any-in-tool-handler.js";
import preferPGlobOverBashFind from "./rules/prefer-p-glob-over-bash-find.js";
import noInvalidAgentFields from "./rules/no-invalid-agent-fields.js";
import enumReturnNeedsAsConst from "./rules/enum-return-needs-as-const.js";
import workflowContextImports from "./rules/workflow-context-imports.js";
import intForCountFields from "./rules/int-for-count-fields.js";

export default {
  meta: {
    name: "rig",
  },
  rules: {
    "define-tool-arg-count": defineToolArgCount,
    "agents-must-be-object": agentsMustBeObject,
    "no-object-literal-record": noObjectLiteralRecord,
    "repair-no-args": repairNoArgs,
    "addon-order": addonOrder,
    "no-implicit-any-in-tool-handler": noImplicitAnyInToolHandler,
    "prefer-p-glob-over-bash-find": preferPGlobOverBashFind,
    "no-invalid-agent-fields": noInvalidAgentFields,
    "enum-return-needs-as-const": enumReturnNeedsAsConst,
    "workflow-context-imports": workflowContextImports,
    "int-for-count-fields": intForCountFields,
  },
};
