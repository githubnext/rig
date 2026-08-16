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

    if (token.value === "," && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      entries.push({ startIndex: currentStart, endIndex: index });
      currentStart = index + 1;
    }
  }

  if (currentStart < endIndex) {
    entries.push({ startIndex: currentStart, endIndex });
  }

  return entries.filter(({ startIndex: si, endIndex: ei }) => {
    for (let i = si; i < ei; i += 1) {
      if (tokens[i]) return true;
    }
    return false;
  });
}

function extractFirstCallAgent(tokens, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex - 2; index += 1) {
    const t = tokens[index];
    const next = tokens[index + 1];
    const after = tokens[index + 2];
    if (
      t?.value === "call"
      && next?.value === "("
      && after?.value
      && /^[A-Za-z_$]/.test(after.value)
    ) {
      return after.value;
    }
  }
  return null;
}

export function scanTokens(tokens, source = "") {
  const problems = [];

  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const [parallel, openParen, openBracket] = tokens.slice(index, index + 3);
    if (
      parallel.value !== "parallel"
      || openParen.value !== "("
      || openBracket.value !== "["
    ) {
      continue;
    }

    // Skip member access like foo.parallel(
    if (tokens[index - 1]?.value === ".") continue;

    const closeBracketIndex = closingBracket(tokens, index + 2);
    if (closeBracketIndex === undefined) continue;

    const closeParen = tokens[closeBracketIndex + 1];
    if (closeParen?.value !== ")") continue;

    const entries = parseTopLevelEntries(tokens, source, index + 3, closeBracketIndex);
    if (entries.length < 2) continue;

    const agents = entries.map(({ startIndex: si, endIndex: ei }) =>
      extractFirstCallAgent(tokens, si, ei),
    );

    const definedAgents = agents.filter(Boolean);
    if (definedAgents.length < 2) continue;

    const unique = new Set(definedAgents);
    if (unique.size < 2) continue;

    problems.push({
      start: parallel.start,
      end: closeParen.end,
      message:
        "parallel() requires homogeneous output types. Use Promise.all([...]) when thunks call agents with different output schemas.",
      kind: "no-heterogeneous-parallel",
      edits: [{ start: parallel.start, end: parallel.end, text: "Promise.all" }],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow parallel() with thunks that call agents with different output schemas",
    },
    fixable: "code",
    schema: [],
    messages: {
      heterogeneous:
        "parallel() requires homogeneous output types. Use Promise.all([...]) when thunks call agents with different output schemas.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "Identifier"
          || node.callee.name !== "parallel"
          || node.arguments.length !== 1
          || node.arguments[0].type !== "ArrayExpression"
        ) {
          return;
        }

        const elements = node.arguments[0].elements;
        if (elements.length < 2) return;

        const agentNames = elements.map((elem) => {
          if (!elem) return null;
          const body =
            elem.type === "ArrowFunctionExpression" ? elem.body :
            elem.type === "FunctionExpression" ? elem.body :
            null;
          if (!body) return null;
          function findCall(node) {
            if (!node || typeof node !== "object") return null;
            if (
              node.type === "CallExpression"
              && node.callee?.type === "Identifier"
              && node.callee.name === "call"
              && node.arguments?.length >= 1
              && node.arguments[0].type === "Identifier"
            ) {
              return node.arguments[0].name;
            }
            for (const val of Object.values(node)) {
              if (Array.isArray(val)) {
                for (const child of val) {
                  const found = findCall(child);
                  if (found) return found;
                }
              } else if (val && typeof val === "object" && val.type) {
                const found = findCall(val);
                if (found) return found;
              }
            }
            return null;
          }
          return findCall(body);
        });

        const defined = agentNames.filter(Boolean);
        if (defined.length < 2) return;

        const unique = new Set(defined);
        if (unique.size < 2) return;

        context.report({
          node: node.callee,
          messageId: "heterogeneous",
          fix(fixer) {
            return fixer.replaceText(node.callee, "Promise.all");
          },
        });
      },
    };
  },
};
