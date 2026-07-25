const recordObjectShape = {
  meta: {
    type: "problem",
    docs: {
      description: "Require object literals passed to s.record to use s.object",
    },
    fixable: "code",
    schema: [],
    messages: {
      wrapObject: "Wrap record object fields with s.object(...).",
    },
  },
  create(context) {
    const schemaHelpers = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "rig") return;

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.imported.name === "s") {
            schemaHelpers.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression"
          || node.callee.computed
          || node.callee.object.type !== "Identifier"
          || !schemaHelpers.has(node.callee.object.name)
          || node.callee.property.type !== "Identifier"
          || node.callee.property.name !== "record"
          || node.arguments[0]?.type !== "ObjectExpression"
        ) {
          return;
        }

        const argument = node.arguments[0];
        context.report({
          node: argument,
          messageId: "wrapObject",
          fix(fixer) {
            return fixer.replaceText(argument, `${node.callee.object.name}.object(${context.sourceCode.getText(argument)})`);
          },
        });
      },
    };
  },
};

export const rigPlugin = {
  rules: {
    "record-object-shape": recordObjectShape,
  },
};
