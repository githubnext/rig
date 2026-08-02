const methods = new Set(["record", "nonEmptyObject"]);

function closingBrace(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "{") depth += 1;
    if (tokens[index].value === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 5; index += 1) {
    const [schema, dot, method, openCall] = tokens.slice(index, index + 4);
    if (
      tokens[index - 1]?.value === "."
      || schema.value !== "s"
      || dot.value !== "."
      || !methods.has(method.value)
      || openCall.value !== "("
    ) {
      continue;
    }

    let objectIndex = index + 4;
    while (tokens[objectIndex]?.value === "(") objectIndex += 1;
    const object = tokens[objectIndex];
    if (object?.value !== "{") continue;

    const closingIndex = closingBrace(tokens, objectIndex);
    const wrapperCount = objectIndex - (index + 4);
    const wrappersClose = Array.from(
      { length: wrapperCount },
      (_, offset) => tokens[(closingIndex ?? tokens.length) + offset + 1]?.value,
    ).every((value) => value === ")");
    if (closingIndex === undefined || !wrappersClose) continue;

    problems.push({
      start: object.start,
      end: tokens[closingIndex].end,
      message: "Wrap object-valued record fields with s.object(...).",
      kind: "no-object-literal-record",
      edits: [
        { start: object.start, text: "s.object(" },
        { start: tokens[closingIndex].end, text: ")" },
      ],
    });
  }

  return problems;
}

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
