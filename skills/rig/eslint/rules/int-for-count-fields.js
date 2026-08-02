const countFieldPattern = /count|total|length|lines|files|items/i;

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 5; index += 1) {
    const [fieldName, colon, s, dot, num] = tokens.slice(index, index + 5);
    if (
      colon.value !== ":"
      || s.value !== "s"
      || dot.value !== "."
      || num.value !== "number"
    ) {
      continue;
    }

    if (!countFieldPattern.test(fieldName.value)) continue;

    problems.push({
      start: s.start,
      end: num.end,
      message: `Use s.int instead of s.number for "${fieldName.value}" — count/total/length/lines/files/items fields should be integers.`,
      kind: "int-for-count-fields",
      edits: [{ start: s.start, end: num.end, text: "s.int" }],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer s.int over s.number for fields named *Count, *Total, *Length, *Lines, *Files, or *Items",
    },
    fixable: "code",
    schema: [],
    messages: {
      useInt:
        "Use s.int instead of s.number for \"{{field}}\" — count/total/length/lines/files/items fields should be integers.",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.computed) return;
        const keyName =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? String(node.key.value)
              : null;
        if (!keyName || !countFieldPattern.test(keyName)) return;

        const { value } = node;
        if (
          value.type !== "MemberExpression"
          || value.computed
          || value.object.type !== "Identifier"
          || value.object.name !== "s"
          || value.property.type !== "Identifier"
          || value.property.name !== "number"
        ) {
          return;
        }

        context.report({
          node: value,
          messageId: "useInt",
          data: { field: keyName },
          fix(fixer) {
            return fixer.replaceText(value, "s.int");
          },
        });
      },
    };
  },
};
