function closingParen(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") depth += 1;
    if (tokens[index].value === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

function topLevelArgs(tokens, openingIndex, closeIndex, source) {
  const args = [];
  let depth = 0;
  let argStart = tokens[openingIndex].end;

  for (let index = openingIndex + 1; index < closeIndex; index += 1) {
    const token = tokens[index];
    if (token.value === "(" || token.value === "{" || token.value === "[") depth += 1;
    if (token.value === ")" || token.value === "}" || token.value === "]") depth -= 1;
    if (depth === 0 && token.value === ",") {
      args.push({
        start: argStart,
        end: token.start,
        text: source.slice(argStart, token.start).trim(),
      });
      argStart = token.end;
    }
  }

  args.push({
    start: argStart,
    end: tokens[closeIndex].start,
    text: source.slice(argStart, tokens[closeIndex].start).trim(),
  });
  return args.filter((arg) => arg.text.length > 0);
}

function toConfigText(args) {
  if (args.length !== 5) return undefined;
  const [, description, parameters, , handler] = args;
  return ` { description: ${description.text}, parameters: ${parameters.text}, handler: ${handler.text} }`;
}

export function scanTokens(tokens, source = "") {
  const problems = [];

  for (let index = 0; index <= tokens.length - 2; index += 1) {
    const [fn, openParen] = tokens.slice(index, index + 2);
    if (
      tokens[index - 1]?.value === "."
      || fn.value !== "defineTool"
      || openParen.value !== "("
    ) {
      continue;
    }

    const closeIndex = closingParen(tokens, index + 1);
    if (closeIndex === undefined) continue;

    const args = topLevelArgs(tokens, index + 1, closeIndex, source);
    if (args.length <= 2) continue;

    const fixedText = toConfigText(args);
    problems.push({
      start: fn.start,
      end: tokens[closeIndex].end,
      message: "defineTool() takes exactly 2 arguments: the tool name and a config object. Use defineTool(name, { description, parameters, handler }).",
      kind: "define-tool-arg-count",
      edits: fixedText
        ? [{
            start: args[1].start,
            end: tokens[closeIndex].start,
            text: `${fixedText}`,
          }]
        : [],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require defineTool() to be called with only a name and config object",
    },
    fixable: "code",
    schema: [],
    messages: {
      argCount: "defineTool() takes exactly 2 arguments: the tool name and a config object. Use defineTool(name, { description, parameters, handler }).",
    },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "Identifier"
          || callee.name !== "defineTool"
          || args.length <= 2
        ) {
          return;
        }

        context.report({
          node,
          messageId: "argCount",
          fix: args.length === 5
            ? (fixer) => fixer.replaceTextRange(
              [args[1].range[0], args[4].range[1]],
              ` { description: ${sourceCode.getText(args[1])}, parameters: ${sourceCode.getText(args[2])}, handler: ${sourceCode.getText(args[4])} }`,
            )
            : undefined,
        });
      },
    };
  },
};
