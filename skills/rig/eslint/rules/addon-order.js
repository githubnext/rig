function closingBracket(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "[") depth += 1;
    if (tokens[index].value === "]") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

function parseTopLevelEntries(tokens, source, startIndex, endIndex) {
  const entries = [];
  let currentStart = startIndex;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    const token = tokens[index];
    if (token.value === "(") parenDepth += 1;
    if (token.value === ")") parenDepth -= 1;
    if (token.value === "[") bracketDepth += 1;
    if (token.value === "]") bracketDepth -= 1;
    if (token.value === "{") braceDepth += 1;
    if (token.value === "}") braceDepth -= 1;

    if (
      token.value === ","
      && parenDepth === 0
      && bracketDepth === 0
      && braceDepth === 0
    ) {
      const start = tokens[currentStart].start;
      const end = token.start;
      entries.push({ start, end, text: source.slice(start, end).trim() });
      currentStart = index + 1;
    }
  }

  if (currentStart < endIndex) {
    const start = tokens[currentStart].start;
    const end = tokens[endIndex - 1].end;
    entries.push({ start, end, text: source.slice(start, end).trim() });
  }

  return entries.filter((entry) => entry.text.length > 0);
}

function isRepairCall(text) {
  return /^repair\s*\(/.test(text);
}

function isSteeringCall(text) {
  return /^steering\s*\(/.test(text);
}

export function scanTokens(tokens, source = "") {
  const problems = [];

  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const [key, colon, openBracket] = tokens.slice(index, index + 3);
    if (
      key.value !== "addons"
      || colon.value !== ":"
      || openBracket.value !== "["
    ) {
      continue;
    }

    const closeIndex = closingBracket(tokens, index + 2);
    if (closeIndex === undefined) continue;

    const entries = parseTopLevelEntries(tokens, source, index + 3, closeIndex);
    if (entries.length !== 2) continue;

    const repairIndex = entries.findIndex((entry) => isRepairCall(entry.text));
    const steeringIndex = entries.findIndex((entry) => isSteeringCall(entry.text));
    if (repairIndex === -1 || steeringIndex === -1 || repairIndex > steeringIndex) {
      continue;
    }

    const fixedText = `[${entries[steeringIndex].text}, ${entries[repairIndex].text}]`;
    problems.push({
      start: openBracket.start,
      end: tokens[closeIndex].end,
      message: "Use addons: [steering(), repair()] so steering can wrap repair retries.",
      kind: "addon-order",
      edits: [{ start: openBracket.start, end: tokens[closeIndex].end, text: fixedText }],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce addons order as [steering(), repair()]",
    },
    fixable: "code",
    schema: [],
    messages: {
      order: "Use addons: [steering(), repair()] so steering can wrap repair retries.",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key.type !== "Identifier"
          || node.key.name !== "addons"
          || node.value.type !== "ArrayExpression"
          || node.value.elements.length !== 2
        ) {
          return;
        }

        const [first, second] = node.value.elements;
        if (
          first?.type !== "CallExpression"
          || second?.type !== "CallExpression"
          || first.callee.type !== "Identifier"
          || second.callee.type !== "Identifier"
          || first.callee.name !== "repair"
          || second.callee.name !== "steering"
        ) {
          return;
        }

        context.report({
          node: node.value,
          messageId: "order",
          fix(fixer) {
            const sourceCode = context.sourceCode;
            const steeringText = sourceCode.getText(second);
            const repairText = sourceCode.getText(first);
            return fixer.replaceText(node.value, `[${steeringText}, ${repairText}]`);
          },
        });
      },
    };
  },
};
