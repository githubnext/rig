function closingParen(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") depth += 1;
    if (tokens[index].value === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const [fn, openParen] = tokens.slice(index, index + 2);
    if (
      tokens[index - 1]?.value === "."
      || fn.value !== "repair"
      || openParen.value !== "("
    ) {
      continue;
    }

    const closeIndex = closingParen(tokens, index + 1);
    if (closeIndex === undefined) continue;
    const hasArgs = tokens
      .slice(index + 2, closeIndex)
      .some((t) => !/^\s*$/.test(t.value));
    if (!hasArgs) continue;

    problems.push({
      start: openParen.end,
      end: tokens[closeIndex].start,
      message: "repair() takes no arguments. Set maxTurns on the agent spec instead.",
      kind: "repair-no-args",
      edits: [{ start: openParen.end, end: tokens[closeIndex].start, text: "" }],
    });
  }

  return problems;
}

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
