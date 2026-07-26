function closingBracket(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "[") depth += 1;
    if (tokens[index].value === "]") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const [key, colon, openBracket] = tokens.slice(index, index + 3);
    if (
      key.value !== "agents"
      || colon.value !== ":"
      || openBracket.value !== "["
    ) {
      continue;
    }

    const closeIndex = closingBracket(tokens, index + 2);
    if (closeIndex === undefined) continue;

    const inner = tokens.slice(index + 3, closeIndex);

    // Collect comma-separated identifier tokens; bail if non-identifiers found.
    const identifiers = [];
    let valid = true;
    for (const token of inner) {
      if (token.value === ",") continue;
      if (/^[A-Za-z_$][\w$]*$/.test(token.value)) {
        identifiers.push(token.value);
      } else {
        valid = false;
        break;
      }
    }

    if (!valid || identifiers.length === 0) continue;

    const fixedText = `{ ${identifiers.join(", ")} }`;

    problems.push({
      start: openBracket.start,
      end: tokens[closeIndex].end,
      message: "agents must be an object, not an array. Use agents: { name } instead of agents: [name].",
      kind: "agents-must-be-object",
      edits: [{ start: openBracket.start, end: tokens[closeIndex].end, text: fixedText }],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require agents to be declared as a named object, not an array",
    },
    fixable: "code",
    schema: [],
    messages: {
      mustBeObject: "agents must be an object, not an array. Use agents: { name } instead of agents: [name].",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key.type !== "Identifier"
          || node.key.name !== "agents"
          || node.value.type !== "ArrayExpression"
        ) {
          return;
        }

        const elements = node.value.elements;
        if (
          elements.length === 0
          || elements.some((el) => el === null || el.type !== "Identifier")
        ) {
          return;
        }

        const names = elements.map((el) => el.name);
        context.report({
          node: node.value,
          messageId: "mustBeObject",
          fix(fixer) {
            return fixer.replaceText(node.value, `{ ${names.join(", ")} }`);
          },
        });
      },
    };
  },
};
