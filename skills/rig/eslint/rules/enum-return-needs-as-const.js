export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require 'as const' on string literal returns inside defineTool handlers to prevent type widening",
    },
    fixable: "code",
    schema: [],
    messages: {
      needsAsConst:
        "String literal returned without 'as const'. TypeScript widens the type to string; add 'as const' to preserve the literal type.",
    },
  },
  create(context) {
    /**
     * Walk up the ancestor chain to determine whether this return statement is
     * directly inside a `handler:` property function body (arrow or regular).
     */
    function insideHandlerProp(node) {
      let current = node.parent;
      while (current) {
        const t = current.type;
        if (
          t === "ArrowFunctionExpression"
          || t === "FunctionExpression"
          || t === "FunctionDeclaration"
        ) {
          const parent = current.parent;
          if (
            parent?.type === "Property"
            && !parent.computed
            && parent.key?.type === "Identifier"
            && parent.key.name === "handler"
          ) {
            return true;
          }
          // Stop at any other function boundary
          return false;
        }
        current = current.parent;
      }
      return false;
    }

    return {
      ReturnStatement(node) {
        const { argument } = node;
        if (
          !argument
          || argument.type !== "Literal"
          || typeof argument.value !== "string"
        ) {
          return;
        }

        if (!insideHandlerProp(node)) return;

        context.report({
          node: argument,
          messageId: "needsAsConst",
          fix(fixer) {
            return fixer.replaceText(argument, `${argument.raw} as const`);
          },
        });
      },
    };
  },
};
