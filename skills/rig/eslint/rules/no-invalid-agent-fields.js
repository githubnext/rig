const validAgentFields = new Set([
  "name",
  "instructions",
  "input",
  "output",
  "model",
  "maxTurns",
  "addons",
  "agents",
  "systemMessage",
  "tools",
]);

function findClosing(tokens, openingIndex) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const open = tokens[openingIndex]?.value;
  const close = pairs[open];
  if (!close) return undefined;
  let depth = 0;
  for (let i = openingIndex; i < tokens.length; i += 1) {
    if (tokens[i].value === open) depth += 1;
    if (tokens[i].value === close) depth -= 1;
    if (depth === 0) return i;
  }
  return undefined;
}

export function scanTokens(tokens) {
  const problems = [];

  for (let index = 0; index <= tokens.length - 2; index += 1) {
    const [fn, openParen] = tokens.slice(index, index + 2);
    if (
      tokens[index - 1]?.value === "."
      || fn.value !== "agent"
      || openParen.value !== "("
    ) {
      continue;
    }

    const closeParenIndex = findClosing(tokens, index + 1);
    if (closeParenIndex === undefined) continue;

    // Find the opening brace of the first argument
    let braceIndex = index + 2;
    while (braceIndex < closeParenIndex && tokens[braceIndex]?.value !== "{") {
      braceIndex += 1;
    }
    if (braceIndex >= closeParenIndex) continue;

    const closeBraceIndex = findClosing(tokens, braceIndex);
    if (closeBraceIndex === undefined || closeBraceIndex > closeParenIndex) continue;

    // Walk the top-level entries of the object literal
    let depth = 0;
    for (let i = braceIndex + 1; i < closeBraceIndex; i += 1) {
      const t = tokens[i];
      if (t.value === "(" || t.value === "{" || t.value === "[") {
        depth += 1;
        continue;
      }
      if (t.value === ")" || t.value === "}" || t.value === "]") {
        depth -= 1;
        continue;
      }
      if (depth !== 0) continue;

      // A bare identifier followed by ":" is a property key
      const next = tokens[i + 1];
      if (
        /^[A-Za-z_$][\w$]*$/.test(t.value)
        && next?.value === ":"
        && !validAgentFields.has(t.value)
      ) {
        problems.push({
          start: t.start,
          end: t.end,
          message: `"${t.value}" is not a valid agent spec field. Valid fields: ${[...validAgentFields].join(", ")}.`,
          kind: "no-invalid-agent-fields",
          edits: [],
        });
      }
    }
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unknown fields on the agent() spec object",
    },
    fixable: null,
    schema: [],
    messages: {
      invalidField:
        "\"{{field}}\" is not a valid agent spec field. Valid fields: {{valid}}.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "Identifier"
          || callee.name !== "agent"
          || args.length === 0
          || args[0].type !== "ObjectExpression"
        ) {
          return;
        }

        for (const prop of args[0].properties) {
          if (prop.type !== "Property") continue; // skip spread
          if (prop.computed) continue; // skip computed keys
          const keyName =
            prop.key.type === "Identifier"
              ? prop.key.name
              : prop.key.type === "Literal"
                ? String(prop.key.value)
                : null;
          if (keyName === null || validAgentFields.has(keyName)) continue;

          context.report({
            node: prop.key,
            messageId: "invalidField",
            data: {
              field: keyName,
              valid: [...validAgentFields].join(", "),
            },
          });
        }
      },
    };
  },
};
