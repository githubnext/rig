export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow arguments to repair() — set maxTurns on the agent spec instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      noArgs: "repair() takes no arguments. Set maxTurns on the agent spec instead.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "Identifier"
          || callee.name !== "repair"
          || args.length === 0
        ) {
          return;
        }

        context.report({
          node,
          messageId: "noArgs",
          fix(fixer) {
            return fixer.replaceText(node, "repair()");
          },
        });
      },
    };
  },
};
