export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require object-valued record schemas to use s.object",
    },
    fixable: "code",
    schema: [],
    messages: {
      wrapObject: "Wrap object-valued record fields with {{schema}}.object(...).",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression"
          || callee.computed
          || callee.object.type !== "Identifier"
          || callee.object.name !== "s"
          || callee.property.type !== "Identifier"
          || !["record", "nonEmptyObject"].includes(callee.property.name)
        ) {
          return;
        }

        const value = node.arguments[0];
        if (!value || value.type !== "ObjectExpression") {
          return;
        }

        context.report({
          node: value,
          messageId: "wrapObject",
          data: {
            schema: callee.object.name,
          },
          fix(fixer) {
            return fixer.replaceText(value, `${callee.object.name}.object(${sourceCode.getText(value)})`);
          },
        });
      },
    };
  },
};
