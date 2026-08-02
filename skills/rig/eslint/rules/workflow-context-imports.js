const workflowContextOnlyNames = new Set(["call", "pipeline", "parallel"]);

export function scanTokens(tokens, source = "") {
  const problems = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const t = tokens[index];
    if (t.value !== "import") continue;

    // Named imports start with "{"
    const next = tokens[index + 1];
    if (!next || next.value !== "{") continue;

    // Find the closing "}" of the named import list
    let depth = 0;
    let closeBraceIndex = -1;
    for (let j = index + 1; j < tokens.length; j += 1) {
      if (tokens[j].value === "{") depth += 1;
      if (tokens[j].value === "}") {
        depth -= 1;
        if (depth === 0) {
          closeBraceIndex = j;
          break;
        }
      }
    }
    if (closeBraceIndex === -1) continue;

    // Next token after "}" must be "from"
    const fromToken = tokens[closeBraceIndex + 1];
    if (!fromToken || fromToken.value !== "from") continue;

    // Check module specifier in raw source — strings are not in the token stream
    const afterFrom = source.slice(fromToken.end).trimStart();
    if (!afterFrom.startsWith('"rig"') && !afterFrom.startsWith("'rig'")) continue;

    // Scan named imports for workflow-context-only names
    for (let j = index + 2; j < closeBraceIndex; j += 1) {
      const nameToken = tokens[j];
      if (!/^[A-Za-z_$][\w$]*$/.test(nameToken.value)) continue;
      if (!workflowContextOnlyNames.has(nameToken.value)) continue;
      // Skip alias targets: `foo as call` — "call" here is the local alias, not the import name
      if (tokens[j - 1]?.value === "as") continue;

      problems.push({
        start: nameToken.start,
        end: nameToken.end,
        message: `"${nameToken.value}" is not exported from "rig"; destructure it from the workflow body context: workflow({ body: async ({ ${nameToken.value} }) => { ... } }).`,
        kind: "workflow-context-imports",
        edits: [],
      });
    }
  }

  return problems;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing workflow body context utilities (call, pipeline, parallel) from \"rig\" — they are only available as destructured context props inside a workflow body",
    },
    fixable: null,
    schema: [],
    messages: {
      notExported:
        "\"{{name}}\" is not exported from \"rig\"; destructure it from the workflow body context: workflow({ body: async ({ {{name}} }) => { ... } }).",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "rig") return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const importedName =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : String(specifier.imported.value);
          if (!workflowContextOnlyNames.has(importedName)) continue;

          context.report({
            node: specifier,
            messageId: "notExported",
            data: { name: importedName },
          });
        }
      },
    };
  },
};
